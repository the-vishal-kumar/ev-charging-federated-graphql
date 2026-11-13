import mongoose from 'mongoose';
import { Logger } from '../../util';
import { mongoConfig } from '../../config';

export const redactMongoUri = (uri: string): string => uri.replace(/\/\/[^/@]*@/, '//***@');

export const connectMongo = async (uri: string): Promise<typeof mongoose> => {
  try {
    await mongoose.connect(uri, mongoConfig.dbOptions);
    Logger.info(`Mongo database is accepting connections on ${redactMongoUri(uri)}`);
    return mongoose;
  } catch (err) {
    Logger.error(`Failed to connect to Mongo database ${redactMongoUri(uri)}:- `, err);
    throw err;
  }
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};
