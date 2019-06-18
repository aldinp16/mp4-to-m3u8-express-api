'use strict'

const express = require('express')
const busboy = require('connect-busboy')
const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')

const app = express()
app.use(busboy({ highWaterMark: 2 * 1024 * 1024, }))

// serve streams file as static
app.use('/streams', express.static(path.join(__dirname, 'streams')))

app.route('/upload').post((req, res, next) => {

  // pipe request to busyboy
  req.pipe(req.busboy)
  req.busboy.on('file', (fieldname, file, filename) => {

    // remove .mp4 format from filename
    const outputFilename = filename.slice(0, filename.length - 4)
    const streamsPath = `/streams/${outputFilename}/${outputFilename}.m3u8`
    const outputDir = path.join(__dirname, `streams/${outputFilename}`)
    const outputFile = path.join(outputDir, `${outputFilename}.m3u8`)

    // check if outputDir exist
    if (fs.existsSync(outputDir)) {
      return res.send({ error: true, message: 'filename already exist, try changename to unique' })
    }

    // if not exist, create it
    fs.mkdirSync(outputDir, { recursive: true })

    const converOptions = [
      '-profile:v baseline', // baseline profile (level 3.0) for H264 video codec
      '-level 3.0', 
      '-s 640x360',          // 640px width, 360px height output video dimensions
      '-start_number 0',     // start the first .ts segment at index 0
      '-hls_time 10',        // 10 second segment duration
      '-hls_list_size 0',    // Maxmimum number of playlist entries (0 means all entries/infinite)
      '-f hls'               // HLS format
    ]

    const convert = ffmpeg(file, { timeout: 432000 })
    convert.addOptions(converOptions)
    convert.output(outputFile)

    convert.on('start', (commandLine) => {
      console.log(`[${new Date()}] Convert of '${filename}' started. Saved to ${outputFile}`)
    })

    convert.on('end', () => {
      console.log(`[${new Date()}] Convert '${filename}' to ${outputFile} finished`)
      return res.send({ error: false, link: streamsPath })
    })

    // start convert
    convert.run()
  })
})

app.route('/').get((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'})
  res.write('<form action="upload" method="post" enctype="multipart/form-data">')
  res.write('<input type="file" name="fileToUpload"><br>')
  res.write('<input type="submit">')
  res.write('</form>')
  return res.end()
})

const server = app.listen(3200, () =>{
  console.log(`[${new Date()}] Listening on port ${server.address().port}`)
})