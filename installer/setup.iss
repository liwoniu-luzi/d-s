[Setup]
AppName=DeepSeek Harness
AppVersion=1.0.0
DefaultDirName=D:\DeepSeek-Harness
DefaultGroupName=DeepSeek Harness
OutputDir=..\dist_installer
OutputBaseFilename=DeepSeek-Harness-Setup
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\DeepSeek-Harness.exe

[Files]
Source: "..\bundle\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autodesktop}\DeepSeek Harness"; Filename: "{app}\DeepSeek-Harness.exe"; WorkingDir: "{app}"; IconFilename: "{app}\assets\icon.ico"
Name: "{group}\DeepSeek Harness"; Filename: "{app}\DeepSeek-Harness.exe"; WorkingDir: "{app}"
Name: "{group}\卸载 DeepSeek Harness"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\DeepSeek-Harness.exe"; Description: "立即运行 DeepSeek Harness"; Flags: nowait postinstall skipifsilent
