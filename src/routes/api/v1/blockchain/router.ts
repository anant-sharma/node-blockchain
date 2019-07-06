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
router.get('/', (req: express.Request, res: express.Response) => {
    try {
        res.status(200).json({
            Chain: blockchain.getChain(),
            PendingTransactions: blockchain.getPendingTransactions(),
        });
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
