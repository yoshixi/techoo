#!/usr/bin/env node
/**
 * Generates app icons from a source image.
 *
 * Source priority (first found wins):
 *   1. resources/icon-source.png  — custom hand-crafted PNG (1024×1024)
 *   2. resources/icon-source.svg  — programmatic SVG design
 *
 * Outputs: build/icon.png, build/icon.icns, build/icon.ico,
 *          resources/logo.png, resources/logo@2x.png
 *
 * Run from the electron app directory: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const buildDir = join(root, 'build')
const iconsetDir = join(root, 'icon.iconset')

const pngSource = join(root, 'resources', 'icon-source.png')
const svgSource = join(root, 'resources', 'icon-source.svg')

const source = existsSync(pngSource) ? pngSource : svgSource
console.log(`Using source: ${source.replace(root + '/', '')}`)

mkdirSync(buildDir, { recursive: true })
mkdirSync(iconsetDir, { recursive: true })

// 1. Render source → 1024×1024 PNG (Linux icon + base for all other formats)
const png1024 = join(buildDir, 'icon.png')
await sharp(source).resize(1024, 1024).png().toFile(png1024)
console.log('✓ build/icon.png (1024×1024)')

// 2. Runtime logos
await sharp(source).resize(420, 420).png().toFile(join(root, 'resources', 'logo.png'))
await sharp(source).resize(840, 840).png().toFile(join(root, 'resources', 'logo@2x.png'))
console.log('✓ resources/logo.png + logo@2x.png')

// 3. macOS iconset
const macSizes = [
  { size: 16,   name: 'icon_16x16.png' },
  { size: 32,   name: 'icon_16x16@2x.png' },
  { size: 32,   name: 'icon_32x32.png' },
  { size: 64,   name: 'icon_32x32@2x.png' },
  { size: 128,  name: 'icon_128x128.png' },
  { size: 256,  name: 'icon_128x128@2x.png' },
  { size: 256,  name: 'icon_256x256.png' },
  { size: 512,  name: 'icon_256x256@2x.png' },
  { size: 512,  name: 'icon_512x512.png' },
  { size: 1024, name: 'icon_512x512@2x.png' },
]
for (const { size, name } of macSizes) {
  await sharp(source).resize(size, size).png().toFile(join(iconsetDir, name))
}
console.log('✓ iconset PNGs generated')

// 4. .icns
execSync(`iconutil -c icns "${iconsetDir}" -o "${join(buildDir, 'icon.icns')}"`)
console.log('✓ build/icon.icns')

// 5. .ico (via 256px intermediate)
const ico256 = join(iconsetDir, 'icon_256x256.png')
execSync(`sips -s format ico "${ico256}" --out "${join(buildDir, 'icon.ico')}"`)
console.log('✓ build/icon.ico')

// 6. Cleanup
rmSync(iconsetDir, { recursive: true })
console.log('✓ Cleaned up iconset directory')

console.log('\nAll icons generated successfully.')
