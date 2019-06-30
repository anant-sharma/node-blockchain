/**
 * Import Dependencies
 */
import * as express from 'express';
import { blockchain } from '../../../../controllers/v1/blockchain';

/**
 * Initialize Router
 */
const router = express.Router();

/**
 * Bind Routes
 */
router.post('/', (req: express.Request, res: express.Response) => {
    try {
        const { amount, sender, recipient } = req.body;

        const transaction = blockchain.createNewTransaction(amount, sender, recipient);

        res.status(200).json(transaction);
    } catch (e) {
        res.status(400).json({
            error: e,
        });
    }
});

/**
 * Export Module
 */
export default router;
