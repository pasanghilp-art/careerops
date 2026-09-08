#!/usr/bin/env node
/**
 * Live modal a11y: focus trap, Escape, backdrop close, page inert.
 * Uses Playwright against a fixture page (no Supabase).
 */
import { chromium } from 'playwright'
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { extname, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' }

const fixture = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>modal a11y fixture</title>
<style>
.hidden{display:none!important}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;padding:24px;z-index:40}
.modal .box{background:#fff;padding:16px;max-width:420px;width:100%}
</style></head><body>
<div id="app">
  <button id="open">Open settings</button>
  <input id="behind" value="should be inert">
</div>
<div id="settings" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="settings_heading">
  <div class="box">
    <h2 id="settings_heading">Settings</h2>
    <input id="s_titles" placeholder="titles">
    <button id="settingsclose">Close</button>
  </div>
</div>
<script type="module">
import { createFocusTrap } from '/web/ui/primitives.mjs'
const MODAL_IDS = ['settings']
const modalRelease = Object.create(null)
const modalBackdrop = Object.create(null)
const $ = (id) => document.getElementById(id)
function syncPageInert(openId){
  for(const child of document.body.children){
    if(!(child instanceof HTMLElement)) continue
    if(openId && child.id === openId){ child.inert = false; continue }
    child.inert = !!openId
  }
}
function openModalId(){
  return MODAL_IDS.find(id => { const el=$(id); return el && !el.classList.contains('hidden') }) || null
}
function trapModal(id, opener, focusEl){
  modalRelease[id]?.()
  modalBackdrop[id]?.()
  const el=$(id); if(!el) return
  el.classList.remove('hidden')
  syncPageInert(id)
  const onBackdrop = (e)=>{ if(e.target === el) closeModal(id) }
  el.addEventListener('click', onBackdrop)
  modalBackdrop[id] = ()=> el.removeEventListener('click', onBackdrop)
  modalRelease[id]=createFocusTrap(el, opener||document.activeElement, focusEl||null)
}
function closeModal(id){
  const el=$(id)
  el?.classList.add('hidden')
  modalBackdrop[id]?.(); modalBackdrop[id]=null
  const release = modalRelease[id]
  modalRelease[id]=null
  syncPageInert(openModalId())
  release?.()
}
$('open').onclick = () => trapModal('settings', $('open'), $('s_titles'))
$('settingsclose').onclick = () => closeModal('settings')
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape') return
  for(const id of MODAL_IDS){
    if(!$(id)?.classList.contains('hidden')){ closeModal(id); return }
  }
})
window.__modalTest = { trapModal, closeModal, $ }
</script>
</body></html>`

const server = createServer((req, res) => {
  try {
    if (req.url === '/' || req.url === '/fixture') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(fixture)
      return
    }
    const file = join(root, decodeURIComponent(req.url.split('?')[0]))
    const body = readFileSync(file)
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('missing')
  }
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const { port } = server.address()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const fails = []
const ok = (name, cond) => { console.log(cond ? `ok  ${name}` : `FAIL ${name}`); if (!cond) fails.push(name) }

await page.goto(`http://127.0.0.1:${port}/fixture`)
await page.click('#open')
ok('opens with focus on first field', await page.evaluate(() => document.activeElement?.id === 's_titles'))
ok('app is inert while open', await page.evaluate(() => document.getElementById('app').inert === true))
ok('settings not inert', await page.evaluate(() => document.getElementById('settings').inert === false))

// Tab cycles inside modal (titles -> close -> titles)
await page.keyboard.press('Tab')
ok('Tab moves to close', await page.evaluate(() => document.activeElement?.id === 'settingsclose'))
await page.keyboard.press('Tab')
ok('Tab wraps to titles', await page.evaluate(() => document.activeElement?.id === 's_titles'))
await page.keyboard.press('Shift+Tab')
ok('Shift+Tab wraps to close', await page.evaluate(() => document.activeElement?.id === 'settingsclose'))

// Cannot tab to behind control while open
const behindFocused = await page.evaluate(() => {
  const behind = document.getElementById('behind')
  behind.focus()
  return document.activeElement === behind
})
ok('inert blocks focusing page behind', behindFocused === false)

await page.keyboard.press('Escape')
ok('Escape closes modal', await page.evaluate(() => document.getElementById('settings').classList.contains('hidden')))
ok('Escape restores opener focus', await page.evaluate(() => document.activeElement?.id === 'open'))
ok('inert cleared after Escape', await page.evaluate(() => document.getElementById('app').inert === false))

await page.click('#open')
// Backdrop click: click the modal root, not the box
await page.locator('#settings').click({ position: { x: 2, y: 2 } })
ok('backdrop click closes', await page.evaluate(() => document.getElementById('settings').classList.contains('hidden')))
ok('backdrop restores opener focus', await page.evaluate(() => document.activeElement?.id === 'open'))

await page.click('#open')
await page.click('#settingsclose')
ok('close button restores opener', await page.evaluate(() => document.activeElement?.id === 'open'))

await browser.close()
server.close()
if (fails.length) {
  console.error(`\ntest-modal-a11y: ${fails.length} failure(s)`)
  process.exit(1)
}
console.log('\ntest-modal-a11y passed')
