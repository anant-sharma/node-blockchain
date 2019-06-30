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
        const lastBlock = blockchain.getLastBlock();
        const previousBlockHash = lastBlock.previousBlockHash;

        const currentBlockData = {
            index: lastBlock.index + 1,
            transactions: blockchain.getPendingTransactions(),
        };

        const nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);

        const blockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);

        const newBlock = blockchain.createNewBlock(nonce, lastBlock.hash, blockHash);

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
