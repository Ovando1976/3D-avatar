import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from './schema.js';
import { registerRestRoutes } from './routes.js';

const PORT = Number(process.env.PORT ?? 4000);

async function bootstrap(): Promise<void> {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

  registerRestRoutes(app);

  const server = new ApolloServer({
    schema: buildSchema()
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  app.listen(PORT, () => {
    console.log(`API Gateway listening on http://localhost:${PORT}`);
  });
}

void bootstrap();
