// Tests never talk to Open Charge Map or New Relic; keep any developer .env values out.
process.env.NODE_ENV = 'test';
delete process.env.OPEN_CHARGE_MAP_API_KEY;
delete process.env.NEW_RELIC_LICENSE_KEY;
process.env.MONGO_URI ??= 'mongodb://localhost:27017/ev_charging_test';
