import { Router } from 'express'
import { verifyToken, uploadDocumentStorage, uploadDocument, getDocumentbyUser, getDocumentbyId, getDocumentStatus, deleteDocument, getHistory, getSummary, getFlashcards, deleteFlashcards, getQuiz, getQuizQuestion, getConcepts } from '../db.js'
import multer from 'multer'
import "dotenv/config";
import axios from 'axios'





const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8000'
const documentsRouter = Router()




/// <--- Router for uploading and processing documents ---> ///
const upload = multer({ storage: multer.memoryStorage() })
documentsRouter.post('/upload', verifyToken, upload.single('file'), async (req, res)=>{
    try {
        const user_id = req.user.id

        const file = req.file
        if (!file) return res.status(400).json({ error: 'No file provided' })

        const filename = file.originalname  
        const mime_type = file.mimetype

        const {data, error} = await uploadDocumentStorage(file, user_id)
        if (error) return res.status(400).json({ error: error.message })

        const path = data.path
        const {document, upload_error} = await uploadDocument(filename, path, mime_type, user_id)
        if (upload_error) return res.status(400).json({ error: upload_error.message })
        const document_id = document.id
        const payload = {
            document_id
        }
        const x_internal_secret = process.env.INTERNAL_SECRET

        axios.post(`${baseUrl}/process`, payload, {
            headers: { 'x-internal-secret': x_internal_secret }
        }).catch(err => console.error('Python processing error:', err.message))
        
       
      

        return res.status(201).json({ message: 'Upload successful', document})

    }
    catch(err){
        res.status(500).json({ error: err.message })
    }
})

documentsRouter.get("/", verifyToken, async (req,res)=>{
    try {
        const user_id = req.user.id
        const {data,error} = await getDocumentbyUser(user_id)
        if(error){
            return res.status(400).json({ error: error.message })
        }
        return res.status(200).json({ message: 'Load successful', data})
    }
    catch(err){
        res.status(500).json({ error: err.message })   
    }
})


documentsRouter.get('/:id', verifyToken, async (req,res)=>{
    try {
        const id = req.params.id
        const {data, error} = await getDocumentbyId(id)
        if(error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Load successful", data})
    }
    catch(err){
        res.status(500).json({error: err.message})
    }
})


documentsRouter.get('/:id/status', verifyToken, async (req,res)=>{
    try{
        const id = req.params.id
        const {data, error} = await getDocumentStatus(id)
        if(error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Load successful", data})
    }
    catch(err){
        res.status(500).json({error: err.message})
    }
})



documentsRouter.delete('/:id', verifyToken, async (req,res)=>{
    try {
        const id = req.params.id
        const user_id = req.user.id
        const {data, error} = await deleteDocument(id, user_id)
        if(error){
            return res.status(400).json({error: error.message})
        }
        if (!data) return res.status(404).json({ error: 'Document not found' })
        return res.status(200).json({message: "Delete successful", data})
    }
    catch(err){
        res.status(500).json({error: err.message})
    }    
})



/// <--- Router for qa section ---> ///
documentsRouter.post('/:id/qa', verifyToken, async (req, res)=>{
    try {
        const user_id = req.user.id
        const document_id = req.params.id
        const {question} = req.body
        const payload = {
            question,
            document_id,
            user_id
        }
        const x_internal_secret = process.env.INTERNAL_SECRET
        const response = await axios.post(`${baseUrl}/qa`, payload, {
            headers: {
                'x-internal-secret': x_internal_secret
            }
        })
        return res.status(200).json(response.data)
    }
    catch (err){
        res.status(500).json({error: err.message})
    }
})


documentsRouter.get('/:id/qa', verifyToken, async (req, res)=>{
    try{
        const user_id = req.user.id
        const document_id = req.params.id
        const {data, error} = await getHistory(document_id, user_id)
        if (error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Loading history successful", data})
    }
    catch(err){
        res.status(500).json({error: err.message})
    }
})


/// <--- Router for the summary section ---> ///
documentsRouter.post('/:id/summary', verifyToken, async (req, res)=>{
    try{
        const user_id = req.user.id
        const document_id = req.params.id
        const x_internal_secret = process.env.INTERNAL_SECRET
        const payload = {
            document_id,
            user_id
        }   
        const response = await axios.post(`${baseUrl}/generate/summary`, payload, {
            headers: {
                'x-internal-secret': x_internal_secret
            }
        })
        return res.status(200).json(response.data)

    }
    catch(err){
        res.status(500).json({error: err.message})
    }
})


documentsRouter.get('/:id/summary', verifyToken, async (req,res)=>{
    try{
        const user_id = req.user.id
        const document_id = req.params.id
        const {data, error} = await getSummary(document_id, user_id)
        if (error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Loading summary successful", data})
    }
    catch (err){
        res.status(200).json({error: err.message})
    }
})



/// <--- Router for flashcards section ---> ///
documentsRouter.post('/:id/flashcards', verifyToken, async (req, res)=>{
    try {
        const user_id = req.user.id
        const document_id = req.params.id
        const x_internal_secret = process.env.INTERNAL_SECRET
        const payload = {
            document_id,
            user_id
        }
        const response = await axios.post(`${baseUrl}/generate/flashcards`, payload,{
            headers:{
                'x-internal-secret': x_internal_secret
            }
        })
        return res.status(200).json(response.data)
    }
    catch(err){
        res.status(500).json({error: err.message})
    }
})

documentsRouter.get('/:id/flashcards', verifyToken, async (req, res)=>{
    try{
        const user_id = req.user.id
        const document_id = req.params.id
        const {data, error} = await getFlashcards(document_id, user_id)
        if (error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Loading flashcards successful", data})
    }
    catch(err){
        res.status(500).json({
            error: err.message
        })
    }
})

documentsRouter.delete('/:id/flashcards', verifyToken, async (req, res)=>{
    try{
        const user_id = req.user.id
        const document_id = req.params.id
        const {data, error} = await deleteFlashcards(document_id, user_id)
        if (error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Deleting flashcards successful", data})
    }
    catch(err){
        res.status(500).json({
            error: err.message
        })
    }
})

/// <--- This is the router for the quiz section ---> ///
documentsRouter.post('/:id/quiz', verifyToken, async (req, res)=>{
    try {
        const user_id = req.user.id
        const document_id = req.params.id
        const x_internal_secret = process.env.INTERNAL_SECRET
        const payload = {
            document_id,
            user_id
        }

        const response = await axios.post(`${baseUrl}/generate/quiz`, payload,{
            headers:{
                'x-internal-secret': x_internal_secret
            }
        })
        return res.status(200).json(response.data)

    }
    catch(err){
        res.status(500).json({
            error: err.message
        })
    }
})


documentsRouter.get('/:id/quiz', verifyToken, async (req, res)=>{
    try{
        const user_id = req.user.id
        const document_id = req.params.id
        const {data, error} = await getQuiz(document_id, user_id)
        if (error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Getting quiz successful", data})
    }
    catch(err){
        res.status(500).json({
            error: err.message
        })
    }
})


documentsRouter.post('/:id/quiz/submit', verifyToken, async (req,res)=>{
    try{
        const {id} = req.body
        const {data, error} = await getQuizQuestion(id)
        if (error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Getting quiz question answer successful", data})

    }
    catch(err){
        res.status(500).json({
            error: err.message
        })
    }
})



/// <--- This is the router section for the key concepts section ---> ///
documentsRouter.post('/:id/concepts', verifyToken, async (req, res)=>{
    try {
        const user_id = req.user.id
        const document_id = req.params.id
        const x_internal_secret = process.env.INTERNAL_SECRET
        const payload = {
            document_id,
            user_id
        }
        const response = await axios.post(`${baseUrl}/generate/concepts`, payload,{
            headers:{
                'x-internal-secret': x_internal_secret
            }
        })
        return res.status(200).json(response.data)

    }
    catch(err){
        res.status(500).json({
            error: err.message
        })
    }
})


documentsRouter.get('/:id/concepts', verifyToken, async (req, res)=>{
    try {
        const user_id = req.user.id
        const document_id = req.params.id
        const {data, error} = await getConcepts(document_id, user_id)
        if (error){
            return res.status(400).json({error: error.message})
        }
        return res.status(200).json({message: "Getting key concepts successful", data})
    }
    catch(err){
        res.status(500).json({
            error: err.message
        })
    }
})

export {documentsRouter}
