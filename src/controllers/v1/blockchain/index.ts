/**
 * This file contains the code required to
 * handle operations corresponding to blockchain
 */
import { isEqual } from 'lodash';
import * as sha256 from 'sha256';
import { MQ } from '../../../common/mq';
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

interface IChainRequest {
    ReplyQueue: string;
}

class Blockchain {
    private Chain: IBlock[] = [];
    private PendingTransactions: ITransaction[] = [];

    private pubsub: PubSub;

    constructor() {
        this.createNewBlock(11, sha256('previousBlockHash'), sha256('hash'));
        this.pubsub = new PubSub('bc.msg.exchange');
        this.addSubscribers();

        setTimeout(() => {
            console.log('[*] Initiating Chain Request');
            this.requestChain();
        }, 5000);
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
        const previousBlockHash = lastBlock.Hash;

        const currentBlockData = {
            Index: lastBlock.Index + 1,
            Transactions: this.getPendingTransactions(),
        };

        const nonce = this.proofOfWork(previousBlockHash, currentBlockData);

        const blockHash = this.hashBlock(previousBlockHash, currentBlockData, nonce);

        const newBlock = this.createNewBlock(nonce, previousBlockHash, blockHash);

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
                case PUBSUB_EVENTS.CHAIN.REQUESTED: {
                    this.publishChain(Data);
                    break;
                }
            }
        });
    }

    private publishChain(data: IChainRequest) {
        const blockChain = {
            Chain: this.Chain,
            PendingTransactions: this.PendingTransactions,
        };

        const msg = {
            Data: blockChain,
            Event: PUBSUB_EVENTS.CHAIN.PUBLISHED,
        };

        MQ.writeToQueue(data.ReplyQueue, JSON.stringify(msg), {
            autoDelete: true,
            durable: true,
            exclusive: false,
        });
    }

    private async requestChain() {
        // Create Reply Queue
        const queue = generateUUID();
        await MQ.createQueue(queue, {
            autoDelete: true,
            durable: true,
            exclusive: false,
        });

        // Publish Chain Request
        this.pubsub.publish({
            Data: {
                ReplyQueue: queue,
            },
            Event: PUBSUB_EVENTS.CHAIN.REQUESTED,
        });

        // Add Listeners
        MQ.establishWorker(
            queue,
            (msgContent: string, msg: any) => {
                const { Event, Data } = JSON.parse(msgContent);

                switch (Event) {
                    case PUBSUB_EVENTS.CHAIN.PUBLISHED: {
                        console.log('[*] Initiating Chain Synchronization');
                        this.synchroniseChain(Data);
                        break;
                    }
                }
            },
            {
                noAck: true,
            }
        );
    }

    private async synchroniseChain(chain: Blockchain) {
        const { Chain, PendingTransactions } = chain;

        // Return if incoming chain is shorter than current chain
        if (Chain.length <= this.Chain.length) {
            if (
                this.PendingTransactions.length < PendingTransactions.length &&
                this.areTransactionsValid(PendingTransactions)
            ) {
                this.PendingTransactions = PendingTransactions;
            }
            return;
        }

        // Check if incoming chain is valid
        if (!this.isChainValid(Chain)) {
            return;
        }

        let isValid = true;

        for (let i = 0; i < this.Chain.length; i++) {
            if (!isValid) {
                break;
            }

            // Check if blocks are equal
            if (!isEqual(this.Chain[i], Chain[i])) {
                isValid = false;
                break;
            }
        }

        if (isValid) {
            this.Chain = Chain;
            this.PendingTransactions = PendingTransactions;
        }
    }

    private isChainValid(chain: IBlock[]) {
        let isValid = true;

        for (let i = 1; i < chain.length && isValid; i++) {
            const block: IBlock = chain[i];
            const previousBlock: IBlock = chain[i - 1];

            // Hash Matching
            if (previousBlock.Hash !== block.PreviousBlockHash) {
                isValid = false;
                break;
            }

            // Check Current Block Hash
            if (
                block.Hash !==
                this.hashBlock(
                    previousBlock.Hash,
                    {
                        Index: i + 1,
                        Transactions: block.Transactions,
                    },
                    block.Nonce
                )
            ) {
                isValid = false;
                break;
            }
        }

        return isValid;
    }

    private areTransactionsValid(transactions: ITransaction[]) {
        let isValid = true;

        for (let i = 0; i < this.PendingTransactions.length && isValid; i++) {
            if (!isEqual(this.PendingTransactions[i], transactions[i])) {
                isValid = false;
                break;
            }
        }

        return isValid;
    }
}

export const blockchain = new Blockchain();
