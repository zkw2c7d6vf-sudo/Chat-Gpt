# Wait for the server before opening a tab. Does not change browser/system settings.
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8765/app' -TimeoutSec 1
        if ($response.StatusCode -eq 200) {
            Start-Process 'http://127.0.0.1:8765/app'
            exit
        }
    } catch {}
    Start-Sleep -Milliseconds 500
}
Write-Host 'Dashboard did not start. Check its console window.'
