/**
 * This file contains the code required to
 * handle operations corresponding to blockchain
 */
import * as sha256 from 'sha256';
import { generateUUID } from '../../../common/utils';
import { IPubSubMessage, PubSub, PUBSUB_EVENTS } from '../pubsub/pubsub';

interface IBlock {
    Index: number;
    Timestamp: number;
    Transactions: ITransaction[];
    Nonce: number;
    Hash: string;
    PreviousBlockHash: string;
}

interface IBlockData {
    Index: number;
    Transactions: ITransaction[];
}

interface ITransaction {
    Amount: number;
    Sender: string;
    Recipient: string;
    TransactionID: string;
}

class Blockchain {
    private Chain: IBlock[] = [];
    private PendingTransactions: ITransaction[] = [];

    private pubsub: PubSub;

    constructor() {
        this.createNewBlock(11, sha256('previousBlockHash'), sha256('hash'));
        this.pubsub = new PubSub('bc.msg.exchange');
        this.addSubscribers();
    }

    public createNewBlock(nonce: number, previousBlockHash: string, hash: string): IBlock {
        const block: IBlock = {
            Hash: hash,
            Index: this.Chain.length + 1,
            Nonce: nonce,
            PreviousBlockHash: previousBlockHash,
            Timestamp: this.Chain.length ? Date.now() : 0,
            Transactions: this.PendingTransactions,
        };

        this.PendingTransactions = [];
        this.Chain.push(block);

        return block;
    }

    public getLastBlock(): IBlock {
        return this.Chain[this.Chain.length - 1];
    }

    public createNewTransaction(amount: number, sender: string, recipient: string): ITransaction {
        const transaction = {
            Amount: amount,
            Recipient: recipient,
            Sender: sender,
            TransactionID: generateUUID(),
        };

        this.pubsub.publish({
            Data: transaction,
            Event: PUBSUB_EVENTS.TRANSACTION.CREATED,
        });

        return transaction;
    }

    public addTransactionToPendingTransactions(transaction: ITransaction): number {
        this.PendingTransactions.push(transaction);
        return this.getLastBlock().Index + 1;
    }

    public hashBlock(previousBlockHash: string, currentBlockData: IBlockData, nonce: number) {
        const data = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
        return sha256(data);
    }

    public proofOfWork(previousBlockHash: string, currentBlockData: IBlockData): number {
        let nonce = 0;
        let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);

        while (hash.substring(0, 4) !== '0000') {
            nonce++;
            hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
        }

        return nonce;
    }

    public getChain() {
        return this.Chain;
    }

    public getPendingTransactions(): ITransaction[] {
        return this.PendingTransactions;
    }

    public addMinedBlockToChain(newBlock: IBlock) {
        const lastBlock: IBlock = this.getLastBlock();

        /**
         * Check if hashes matches
         */
        const isHashCorrect = lastBlock.Hash === newBlock.PreviousBlockHash;

        /**
         * Check if index matches
         */
        const isIndexCorrect = lastBlock.Index + 1 === newBlock.Index;

        if (isHashCorrect && isIndexCorrect) {
            this.Chain.push(newBlock);
            this.PendingTransactions = [];
        }
    }

    public mineBlock(): IBlock {
        const lastBlock = this.getLastBlock();
        const previousBlockHash = lastBlock.PreviousBlockHash;

        const currentBlockData = {
            Index: lastBlock.Index + 1,
            Transactions: this.getPendingTransactions(),
        };

        const nonce = this.proofOfWork(previousBlockHash, currentBlockData);

        const blockHash = this.hashBlock(previousBlockHash, currentBlockData, nonce);

        const newBlock = this.createNewBlock(nonce, lastBlock.Hash, blockHash);

        this.pubsub.publish({
            Data: newBlock,
            Event: PUBSUB_EVENTS.BLOCK.MINED,
        });

        return newBlock;
    }

    private addSubscribers() {
        this.pubsub.subscribe((msg: IPubSubMessage) => {
            const { Event, Data } = msg;

            switch (Event) {
                case PUBSUB_EVENTS.TRANSACTION.CREATED: {
                    this.addTransactionToPendingTransactions(Data);
                    break;
                }
                case PUBSUB_EVENTS.BLOCK.MINED: {
                    this.addMinedBlockToChain(Data);
                    break;
                }
            }
        });
    }
}

export const blockchain = new Blockchain();
