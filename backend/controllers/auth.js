import { Router } from 'express'
import {createUser ,signinUser, logoutUser, verifyToken} from '../db.js'


const authRouter = Router()

authRouter.post('/register', async (req, res)=>{
    try{
        const {email, password} = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' })
        }
        const { user, error } = await createUser(email, password)
        if (error) return res.status(400).json({ error: error.message })
        return res.status(201).json({
                message: 'Registration successful',
                user: user.user
        })
    }
    catch(err){
        res.status(500).json({ error: err.message });
    }
})


authRouter.post('/login', async (req, res)=>{
    try{
        const {email, password} = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' })
        }
    
        const {user, error} = await signinUser(email, password)
        if (error) return res.status(400).json({ error: error.message })
        return res.status(200).json({
                access_token: user.session.access_token,
                refresh_token: user.session.refresh_token,
                user: user.user
        })
    }
    catch(err){
        res.status(500).json({error: err.message})
    }
})



authRouter.post('/logout', async (req, res) => {
    try {
        const { error } = await logoutUser()
        if (error) return res.status(400).json({ error: error.message })
        return res.status(200).json({ message: 'Logged out successfully' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})


authRouter.get('/me', verifyToken, async (req, res) => {
    try {
        return res.status(200).json({ user: req.user })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

export {authRouter}