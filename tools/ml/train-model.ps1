#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$DatasetPath,
  [ValidateSet('preference','engagement')][string]$Target='preference',
  [string]$OutDir=(Join-Path $PSScriptRoot "output-$Target"),
  [int]$MinLabels=100,
  [switch]$Promote,
  [switch]$TestOnly,
  [switch]$ConfirmRealLabels
)
$ErrorActionPreference='Stop'
$python = if (Get-Command py -ErrorAction SilentlyContinue) { @('py','-3') } elseif (Get-Command python -ErrorAction SilentlyContinue) { @('python') } else { throw 'Python 3 not found.' }
if (-not (Test-Path -LiteralPath $DatasetPath -PathType Leaf)) { throw "Dataset not found: $DatasetPath" }
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$args=@((Join-Path $PSScriptRoot 'train_pipeline.py'),$DatasetPath,'--target',$Target,'--out-dir',$OutDir,'--min-labels',$MinLabels)
if($Promote){$args+='--promote'}
if($TestOnly){$args+='--test-only'}
if($ConfirmRealLabels){$args+='--confirm-real-labels'}
Write-Host "Training $Target model..." -ForegroundColor Cyan
if($python.Count -eq 2){& $python[0] $python[1] @args}else{& $python[0] @args}
if($LASTEXITCODE -ne 0){throw "Training pipeline failed with exit code $LASTEXITCODE"}
Write-Host "Output: $OutDir" -ForegroundColor Green
