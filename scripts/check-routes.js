const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const appConfig = require(path.join(rootDir, 'app.json'))
const requiredExtensions = ['.json', '.wxml', '.js', '.wxss']

function collectPages() {
  const pages = [...(appConfig.pages || [])]
  for (const subPackage of appConfig.subPackages || []) {
    for (const page of subPackage.pages || []) {
      pages.push(`${subPackage.root}/${page}`)
    }
  }
  return pages
}

const missingFiles = []

for (const page of collectPages()) {
  for (const ext of requiredExtensions) {
    const filePath = path.join(rootDir, `${page}${ext}`)
    if (!fs.existsSync(filePath)) {
      missingFiles.push(path.relative(rootDir, filePath))
    }
  }
}

if (missingFiles.length > 0) {
  console.error('Missing page files:')
  for (const file of missingFiles) {
    console.error(`- ${file}`)
  }
  process.exit(1)
}

console.log(`Route check passed: ${collectPages().length} pages`)
