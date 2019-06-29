/**
 * Import Dependencies
 */
import * as express from 'express';
/**
 * Import Routes
 */
import blockchainRouter from './blockchain/router';
import clockRouter from './clock/router';
import mineRouter from './mine/router';
import transactionRouter from './transactions/router';

/**
 * Initialize Router
 */
const router = express.Router();

/**
 * Bind Routes
 */
router.use('/clock', clockRouter);
router.use('/blockchain', blockchainRouter);
router.use('/transactions', transactionRouter);
router.use('/mine', mineRouter);

/**
 * Export Module
 */
export default router;
