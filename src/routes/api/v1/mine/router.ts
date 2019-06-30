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
        const newBlock = blockchain.mineBlock();

        res.status(200).json({
            block: newBlock,
            note: 'Block Mined Successfully',
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
