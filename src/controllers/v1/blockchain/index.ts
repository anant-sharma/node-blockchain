/**
 * This file contains the code required to
 * handle operations corresponding to blockchain
 */
import * as sha256 from 'sha256';
import { generateUUID } from '../../../common/utils';
import { IPubSubMessage, PubSub, PUBSUB_EVENTS } from '../pubsub/pubsub';

interface IBlock {
    index: number;
    timestamp: number;
    transactions: ITransaction[];
    nonce: number;
    hash: string;
    previousBlockHash: string;
}

interface IBlockData {
    index: number;
    transactions: ITransaction[];
}

interface ITransaction {
    amount: number;
    sender: string;
    recipient: string;
    transactionId: string;
}

class Blockchain {
    private chain: IBlock[] = [];
    private pendingTransactions: ITransaction[] = [];

    private pubsub: PubSub;

    constructor() {
        this.createNewBlock(11, sha256('previousBlockHash'), sha256('hash'));
        this.pubsub = new PubSub('bc.msg.exchange');
        this.addSubscribers();
    }

    public createNewBlock(nonce: number, previousBlockHash: string, hash: string): IBlock {
        const block: IBlock = {
            hash,
            index: this.chain.length + 1,
            nonce,
            previousBlockHash,
            timestamp: Date.now(),
            transactions: this.pendingTransactions,
        };

        this.pendingTransactions = [];
        this.chain.push(block);

        return block;
    }

    public getLastBlock(): IBlock {
        return this.chain[this.chain.length - 1];
    }

    public createNewTransaction(amount: number, sender: string, recipient: string): ITransaction {
        const transaction = {
            amount,
            recipient,
            sender,
            transactionId: generateUUID(),
        };

        this.pubsub.publish({
            Data: transaction,
            Event: PUBSUB_EVENTS.TRANSACTIONS.CREATED,
        });

        return transaction;
    }

    public addTransactionToPendingTransactions(transaction: ITransaction): number {
        this.pendingTransactions.push(transaction);
        return this.getLastBlock().index + 1;
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
        return this.chain;
    }

    public getPendingTransactions(): ITransaction[] {
        return this.pendingTransactions;
    }

    private addSubscribers() {
        this.pubsub.subscribe((msg: IPubSubMessage) => {
            const { Event, Data } = msg;

            switch (Event) {
                case PUBSUB_EVENTS.TRANSACTIONS.CREATED: {
                    this.addTransactionToPendingTransactions(Data);
                    break;
                }
            }
        });
    }
}

export const blockchain = new Blockchain();
