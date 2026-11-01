Set-ExecutionPolicy -Scope Process Bypass -Force
& "$PSScriptRoot\venv\Scripts\python.exe" "$PSScriptRoot\live.py" @args

