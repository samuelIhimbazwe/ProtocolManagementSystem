import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Serve Vite production build when running unified PMSS. */
export function mountWebApp(app) {
  const dist = path.join(__dirname, '..', '..', 'prototype', 'dist')
  app.use(express.static(dist, { index: false }))

  const apiPrefix =
    /^\/(auth|schedules|users|members|settings|attendance|config|health|dashboard|reports|notifications)(\/|$)/

  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' || apiPrefix.test(req.path)) return next()
    res.sendFile(path.join(dist, 'index.html'), (err) => {
      if (err) next(err)
    })
  })
}
