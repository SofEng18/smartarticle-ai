@echo off
echo Disabling maintenance mode...
if exist maintenance.flag (
    del maintenance.flag
    echo maintenance.flag file deleted.
) else (
    echo maintenance.flag does not exist.
)
pause
