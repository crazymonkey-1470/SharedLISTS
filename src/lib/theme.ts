import { readLocal, writeLocal } from './storage'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'osl.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePref(): ThemePref {
  const v = readLocal(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111214' : '#f6f6f3')
}

export function setThemePref(pref: ThemePref) {
  writeLocal(KEY, pref === 'system' ? null : pref)
  applyTheme(pref)
}

media.addEventListener('change', () => applyTheme())
