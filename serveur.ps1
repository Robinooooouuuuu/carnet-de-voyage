# =====================================================================
# serveur.ps1 : un tout petit serveur web local
# =====================================================================
# Pourquoi ? Une page ouverte par double-clic a une adresse "file://...".
# Certains services (comme les cartes OpenStreetMap) la refusent.
# Ce serveur donne a tes pages une vraie adresse web : http://localhost:8000/
# "localhost" veut dire "cet ordinateur" : personne d'autre n'y a acces.
#
# Utilisation : double-clic sur lancer-serveur.bat
# Pour arreter : ferme la fenetre noire.
# =====================================================================

param(
  [string]$page = "index.html",   # la page a ouvrir dans le navigateur
  [switch]$SansNavigateur         # ne pas ouvrir le navigateur automatiquement
)

$port   = 8000
$racine = (Resolve-Path $PSScriptRoot).Path.TrimEnd('\') + '\'

# Le "type" de chaque fichier, pour que le navigateur sache comment le lire
$types = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".webmanifest" = "application/manifest+json"
}

$serveur = New-Object System.Net.HttpListener
$serveur.Prefixes.Add("http://localhost:$port/")
$serveur.Start()

Write-Host ""
Write-Host "  Serveur lance : http://localhost:$port/" -ForegroundColor Green
Write-Host "  Appli : http://localhost:$port/  (exemple : http://localhost:$port/?demo)"
Write-Host ""
Write-Host "  Laisse cette fenetre ouverte. Ferme-la pour arreter le serveur."
Write-Host ""

if (-not $SansNavigateur) { Start-Process "http://localhost:$port/$page" }

# Boucle : on attend une demande du navigateur, on renvoie le fichier, on recommence
while ($serveur.IsListening) {
  $demande = $serveur.GetContext()
  $reponse = $demande.Response

  $chemin = [Uri]::UnescapeDataString($demande.Request.Url.AbsolutePath.TrimStart('/'))
  if ($chemin -eq "") { $chemin = "index.html" }
  $fichier = [IO.Path]::GetFullPath((Join-Path $racine $chemin))

  # Securite : on ne sert que des fichiers situes DANS le dossier de l'appli
  if ($fichier.StartsWith($racine) -and (Test-Path -LiteralPath $fichier -PathType Leaf)) {
    $octets = [IO.File]::ReadAllBytes($fichier)
    $ext = [IO.Path]::GetExtension($fichier).ToLower()
    if ($types.ContainsKey($ext)) { $reponse.ContentType = $types[$ext] } else { $reponse.ContentType = "application/octet-stream" }
    $reponse.Headers.Add("Cache-Control", "no-store")   # toujours la derniere version des fichiers
    $reponse.OutputStream.Write($octets, 0, $octets.Length)
    Write-Host "  200  /$chemin"
  } else {
    $reponse.StatusCode = 404
    Write-Host "  404  /$chemin (introuvable)" -ForegroundColor Yellow
  }
  $reponse.Close()
}
