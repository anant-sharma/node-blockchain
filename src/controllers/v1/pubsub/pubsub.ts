/**
 * This file contains the code required to
 * setup pubsub methods
 */
import { MQ } from '../../../common/mq';
import { delay, generateUUID } from '../../../common/utils';
import { mqConfig } from '../../../config/config';

export const PUBSUB_EVENTS = {
    BLOCK: {
        MINED: 'BLOCK.MINED',
    },
    TRANSACTION: {
        CREATED: 'TRANSACTION.CREATED',
    },
};

export interface IPubSubMessage {
    Event: string;
    Data: any;
}

export class PubSub {
    private isInitialised: boolean = false;

    constructor(private exchange: string = 'bc.msg.exchange', private queue: string = generateUUID()) {
        this.init();
    }

    public publish(data: IPubSubMessage) {
        MQ.publish(this.exchange, '', JSON.stringify(data));
    }

    public async subscribe(onMessage: (msgContent: IPubSubMessage, msg?: Buffer) => any) {
        while (!this.isInitialised) {
            await delay(1000);
        }

        MQ.establishWorker(
            this.queue,
            (msgContent: string, msg: any) => {
                onMessage(JSON.parse(msgContent), msg);
            },
            {
                noAck: true,
            }
        );
    }

    private async init() {
        // Establish Connection with MQ
        await MQ.connect(mqConfig.url);

        // Create Channel
        await MQ.createChannel();

        // Create Exchange
        await MQ.createExchange(this.exchange);

        // Create Queue
        await MQ.createQueue(this.queue, {
            durable: true,
            exclusive: true,
        });
        console.info(`[*] Queue ${this.queue} Created.`);

        // Bind Queue To Exchange
        await MQ.bindQueueWithExchange(this.queue, this.exchange);
        console.info(`[*] Queue ${this.queue} Bound To Exchange ${this.exchange}.`);

        // Create Exchange Log Queue
        await MQ.createQueue(`${this.exchange}-logs`, {
            durable: true,
            messageTtl: 86400,
        });

        // Bind Exchange Log Queue
        await MQ.bindQueueWithExchange(`${this.exchange}-logs`, this.exchange);

        this.isInitialised = true;
    }
}
