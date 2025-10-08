import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull
} from 'graphql';
import { CollaborationSessionService } from '@3d-avatar/collaboration-sdk';
import { PoseGenerationClient } from '@3d-avatar/ai-clients';

const sessionService = new CollaborationSessionService();
const poseClient = new PoseGenerationClient();

const sessionType = new GraphQLObjectType({
  name: 'Session',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    participants: { type: new GraphQLList(GraphQLString) },
    lastUpdated: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: session => new Date(session.lastUpdated).toISOString()
    }
  }
});

export function buildSchema(): GraphQLSchema {
  const queryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      health: {
        type: GraphQLString,
        resolve: () => 'ok'
      },
      activeSessions: {
        type: new GraphQLList(sessionType),
        resolve: () => sessionService.listSessionSummaries()
      }
    }
  });

  const mutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      suggestPose: {
        type: GraphQLString,
        args: {
          prompt: { type: GraphQLString }
        },
        resolve: async (_, args) => {
          if (!args.prompt) {
            throw new Error('prompt is required');
          }

          const pose = await poseClient.suggestPose(args.prompt);
          return pose.id;
        }
      },
      createSession: {
        type: sessionType,
        args: {
          participants: { type: new GraphQLList(GraphQLString) }
        },
        resolve: (_, args) => {
          if (!args.participants || args.participants.length === 0) {
            throw new Error('participants are required');
          }

          return sessionService.createSession(args.participants);
        }
      }
    }
  });

  return new GraphQLSchema({ query: queryType, mutation: mutationType });
}
