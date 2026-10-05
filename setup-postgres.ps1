$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Runs locally on the student's computer. Passwords are never printed.
$taskPsqlCommand = Get-Command psql -ErrorAction SilentlyContinue
$taskPsqlPath = if ($taskPsqlCommand) { $taskPsqlCommand.Source } else { 'D:\PostgreSQL\bin\psql.exe' }
if (-not (Test-Path -LiteralPath $taskPsqlPath)) {
    $taskPgRegistry = Get-ChildItem -LiteralPath 'HKLM:\SOFTWARE\PostgreSQL\Installations' -ErrorAction SilentlyContinue | ForEach-Object { Get-ItemProperty -LiteralPath $_.PSPath }
    foreach ($taskPgInstall in $taskPgRegistry) {
        $taskCandidate = Join-Path $taskPgInstall.'Base Directory' 'bin\psql.exe'
        if (Test-Path -LiteralPath $taskCandidate) { $taskPsqlPath = $taskCandidate; break }
    }
}
if (-not (Test-Path -LiteralPath $taskPsqlPath)) { throw 'PostgreSQL command-line tools were not found. Include them in the PostgreSQL installation.' }

$taskEnvPath = Join-Path $PSScriptRoot '.env'
$taskCreatedRole = $false
$taskCreatedDatabase = $false
$taskOriginalPgPassword = $env:PGPASSWORD
$taskOriginalPgTimeout = $env:PGCONNECT_TIMEOUT
$taskSecretPointer = [IntPtr]::Zero
try {
    $env:PGCONNECT_TIMEOUT = '5'
    # Validate an existing setup without overwriting it or requesting an admin password.
    if (Test-Path -LiteralPath $taskEnvPath) {
        $taskExistingConfig = @{}
        Get-Content -LiteralPath $taskEnvPath | ForEach-Object {
            if ($_ -match '^([A-Z_]+)=(.*)$') { $taskExistingConfig[$Matches[1]] = $Matches[2] }
        }
        if ($taskExistingConfig['PGHOST'] -ne '127.0.0.1' -or $taskExistingConfig['PGPORT'] -ne '5432' -or $taskExistingConfig['PGUSER'] -ne 'shimmery_app' -or $taskExistingConfig['PGDATABASE'] -ne 'shimmery_central' -or -not $taskExistingConfig['PGPASSWORD']) {
            throw 'An existing .env is present with a different configuration. It has been preserved; ask Codex to check it without sharing its password.'
        }
        $env:PGPASSWORD = $taskExistingConfig['PGPASSWORD']
        & $taskPsqlPath -X -w -h 127.0.0.1 -p 5432 -U shimmery_app -d shimmery_central -v ON_ERROR_STOP=1 -q -c 'SELECT 1 AS project_database_ready;'
        if ($LASTEXITCODE -ne 0) { throw 'The existing project database configuration could not connect. The configuration has been preserved.' }
        Write-Host 'Project database authentication is ready. Tell Codex that setup completed.' -ForegroundColor Green
        exit 0
    }

    Write-Host 'Shimmery Central - PostgreSQL project setup'
    Write-Host 'Enter the postgres password you chose during installation. It stays on this computer.'
    $taskSecurePassword = Read-Host 'PostgreSQL installation password' -AsSecureString
    $taskSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecurePassword)
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskSecretPointer)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskSecretPointer)
    $taskSecretPointer = [IntPtr]::Zero
    $taskSecurePassword.Dispose()

    $taskLoginResult = & $taskPsqlPath -X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c 'SELECT 1;'
    if ($LASTEXITCODE -ne 0 -or $taskLoginResult -ne '1') { throw 'PostgreSQL login failed. Check the installation password and run this setup again.' }

    $taskCollision = & $taskPsqlPath -X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c "SELECT (SELECT count(*) FROM pg_roles WHERE rolname='shimmery_app') + (SELECT count(*) FROM pg_database WHERE datname='shimmery_central');"
    if ($LASTEXITCODE -ne 0) { throw 'Could not check project database names.' }
    if ($taskCollision -ne '0') { throw 'A shimmery_app role or shimmery_central database already exists. Nothing was changed. Tell Codex so the existing database can be reused safely.' }

    $taskRandomBytes = New-Object byte[] 32
    $taskGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskGenerator.GetBytes($taskRandomBytes) } finally { $taskGenerator.Dispose() }
    $taskProjectPassword = ([BitConverter]::ToString($taskRandomBytes)).Replace('-', '').ToLowerInvariant()
    # SQL is passed through stdin so the generated password is not in process arguments.
    "CREATE ROLE shimmery_app LOGIN PASSWORD '$taskProjectPassword';" | & $taskPsqlPath -X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the dedicated project role.' }
    $taskCreatedRole = $true
    & $taskPsqlPath -X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c 'CREATE DATABASE shimmery_central OWNER shimmery_app;'
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the project database.' }
    $taskCreatedDatabase = $true

    $taskConfig = @(
        '# Private local database configuration. Do not share this file.'
        'DB_ENGINE=postgres'
        'PGHOST=127.0.0.1'
        'PGPORT=5432'
        'PGDATABASE=shimmery_central'
        'PGUSER=shimmery_app'
        "PGPASSWORD=$taskProjectPassword"
    )
    [IO.File]::WriteAllLines($taskEnvPath, $taskConfig, (New-Object Text.UTF8Encoding($false)))
    $env:PGPASSWORD = $taskProjectPassword
    & $taskPsqlPath -X -w -h 127.0.0.1 -p 5432 -U shimmery_app -d shimmery_central -v ON_ERROR_STOP=1 -q -c 'SELECT current_database() AS project_database;'
    if ($LASTEXITCODE -ne 0) { throw 'The database was created, but its final connection check failed. Local configuration was saved.' }
    Write-Host ''
    Write-Host 'SUCCESS: Project database created and connection verified.' -ForegroundColor Green
    Write-Host 'Only the separate project account password was saved locally in .env.'
    Write-Host 'Run start.cmd to open the PostgreSQL-backed app. Existing local demo records are preserved on first initialization.'
} catch {
    # Only clean up an empty role created by this invocation if database creation failed.
    if ($taskCreatedRole -and -not $taskCreatedDatabase) {
        & $taskPsqlPath -X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -q -c 'DROP ROLE shimmery_app;' | Out-Null
    }
    Write-Host ('Setup did not finish: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($taskSecretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskSecretPointer) }
    $env:PGPASSWORD = $taskOriginalPgPassword
    $env:PGCONNECT_TIMEOUT = $taskOriginalPgTimeout
    $taskProjectPassword = $null
    $taskConfig = $null
    $taskExistingConfig = $null
}
