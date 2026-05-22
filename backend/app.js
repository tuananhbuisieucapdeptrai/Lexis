import express from 'express'
import cors from 'cors'
import { authRouter } from './controllers/auth.js'
import { documentsRouter } from './controllers/documents.js'

const app = express()
app.use(express.json()) 
app.use(cors())



app.use('/api/auth', authRouter)
app.use('/api/documents', documentsRouter)

export default app