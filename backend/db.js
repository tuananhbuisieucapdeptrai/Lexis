/* This file is to connect to the database */
import { createClient } from '@supabase/supabase-js';
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/// <--- The list of functions relates to authentication ---> ///
async function createUser(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { user: data, error }
}


async function signinUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { user: data, error }
}


async function logoutUser() {
    const { error } = await supabase.auth.signOut()
    return { error }
}

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' })
        }

        const token = authHeader.split(' ')[1]
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' })
        }

        req.user = user
        next()

    } catch (err) {
        return res.status(401).json({ error: 'Authentication failed' })
    }
}



/// <--- This is the list of functions to work with the documents --->///
async function uploadDocumentStorage(file, userId) {
    const filePath = `${userId}/${Date.now()}_${file.originalname}`

    const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
            contentType: file.mimetype
        })

    return { data, error }
}


async function uploadDocument(name, path, type, user_id){
    const document = {
        user_id,
        "filename": name,
        "storage_path": path,
        "status": "processing",
        "mime_type": type
    }


    const {data, error} = await supabase.from('documents').insert(document).select().single()
    return {document: data, upload_error: error}
}



async function getDocumentbyUser(userId){
    const {data, error} = await supabase.from('documents').select('*').eq('user_id', userId)
    return {data, error}

}


async function getDocumentbyId(id){
    const {data, error} = await supabase.from('documents').select('*').eq('id', id)
    return {data, error}
}

async function getDocumentStatus(id){
    const {data, error} = await supabase.from('documents').select('status').eq('id', id)
    return {data, error}
}

async function deleteDocument(id, userId){
    const {data, error} = await supabase.from('documents').delete().eq('id', id).eq('user_id', userId).select().single()
    return {data, error}
}

/// <--- This is the list of functions to work with the qas and conversations--->///
async function getHistory(document_id,user_id){
    const {data, error} = await supabase.from('conversations').select('*').eq('document_id', document_id).eq('user_id', user_id)
    return {data, error}
}


/// <--- This is the list of functions to work with the summary ---> ///
async function getSummary(document_id, user_id){
    const {data, error} = await supabase.from('summaries').select('*').eq('document_id', document_id).eq('user_id', user_id)
    return {data, error}
}



/// <--- This is the list of functions to work with the flashcards  ---> ///
async function getFlashcards(document_id, user_id){
    const {data, error} = await supabase.from('flashcards').select('*').eq('document_id', document_id).eq('user_id', user_id)
    return {data, error}
}

async function deleteFlashcards(document_id, user_id){
    const {data, error} = await supabase.from('flashcards').delete().eq('document_id', document_id).eq('user_id', user_id).select()
    return {data, error}
}



/// <--- This is the list of functions to work with the quiz ---> ///
async function getQuiz(document_id, user_id){
    const {data, error} = await supabase.from('quiz_questions').select('*').eq('document_id', document_id).eq('user_id', user_id)
    return {data, error}
}

async function getQuizQuestion(id){
    const {data, error} = await supabase.from('quiz_questions').select('*').eq('id', id).single()
    return {data, error}
}


/// <--- This is the list of functions to work with the concepts ---> ///
async function getConcepts(document_id, user_id){
    const {data, error} = await supabase.from('key_concepts').select('*').eq('document_id', document_id).eq('user_id', user_id)
    return {data, error}
}


export {supabase, createUser ,signinUser, logoutUser, verifyToken, uploadDocumentStorage, uploadDocument, getDocumentbyUser, getDocumentbyId, getDocumentStatus, deleteDocument, getHistory, getSummary, getFlashcards, deleteFlashcards, getQuiz, getQuizQuestion, getConcepts}
