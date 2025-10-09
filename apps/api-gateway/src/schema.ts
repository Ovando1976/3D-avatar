import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInt
} from 'graphql';
import { type SessionDetail } from '@3d-avatar/collaboration-sdk';
import { poseClient, sessionService } from './services.js';

const poseType = new GraphQLObjectType({
  name: 'Pose',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    createdAt: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: pose => new Date(pose.createdAt).toISOString()
    },
    keyframeCount: { type: new GraphQLNonNull(GraphQLInt) },
    source: { type: GraphQLString },
    prompt: { type: GraphQLString },
    previewUrl: { type: GraphQLString }
  }
});

const sessionSummaryType = new GraphQLObjectType({
  name: 'SessionSummary',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    participants: { type: new GraphQLList(GraphQLString) },
    lastUpdated: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: session => new Date(session.lastUpdated).toISOString()
    },
    poseCount: { type: new GraphQLNonNull(GraphQLInt) }
  }
});

const sessionType = new GraphQLObjectType({
  name: 'Session',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    participants: { type: new GraphQLList(GraphQLString) },
    lastUpdated: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: session => new Date(session.lastUpdated).toISOString()
    },
    poseCount: { type: new GraphQLNonNull(GraphQLInt) },
    poses: { type: new GraphQLList(poseType) }
  }
});

function formatSession(session: SessionDetail): SessionDetail {
  return {
    ...session,
    poses: session.poses.slice(0, 50)
  };
}

export function buildSchema(): GraphQLSchema {
  const queryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      health: {
        type: GraphQLString,
        resolve: () => 'ok'
      },
      activeSessions: {
        type: new GraphQLList(sessionSummaryType),
        resolve: () => sessionService.listSessionSummaries()
      },
      session: {
        type: sessionType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLString) }
        },
        resolve: (_, args): SessionDetail | null => {
          const session = sessionService.getSession(args.id);
          return session ? formatSession(session) : null;
        }
      }
    }
  });

  const mutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      suggestPose: {
        type: poseType,
        args: {
          prompt: { type: new GraphQLNonNull(GraphQLString) },
          sessionId: { type: GraphQLString }
        },
        resolve: async (_, args) => {
          const pose = await poseClient.suggestPose(args.prompt);
          const createdAt = Date.now();

          if (args.sessionId) {
            const session = sessionService.getSession(args.sessionId);

            if (!session) {
              throw new Error(`Session ${args.sessionId} not found`);
            }

            const updated = sessionService.recordPose(args.sessionId, {
              id: pose.id,
              keyframeCount: pose.data.keyframes.length,
              prompt: args.prompt,
              source: 'ai',
              createdAt
            });

            return updated.poses[0];
          }

          return {
            id: pose.id,
            createdAt,
            keyframeCount: pose.data.keyframes.length,
            source: 'ai',
            prompt: args.prompt
          };
        }
      },
      createSession: {
        type: sessionType,
        args: {
          participants: { type: new GraphQLList(GraphQLString) }
        },
        resolve: (_, args): SessionDetail => {
          if (!args.participants || args.participants.length === 0) {
            throw new Error('participants are required');
          }

          const session = sessionService.createSession(args.participants);
          return formatSession(session);
        }
      },
      recordPose: {
        type: sessionType,
        args: {
          sessionId: { type: new GraphQLNonNull(GraphQLString) },
          poseId: { type: new GraphQLNonNull(GraphQLString) },
          keyframeCount: { type: new GraphQLNonNull(GraphQLInt) },
          source: { type: GraphQLString },
          prompt: { type: GraphQLString }
        },
        resolve: (_, args): SessionDetail => {
          const session = sessionService.recordPose(args.sessionId, {
            id: args.poseId,
            keyframeCount: args.keyframeCount,
            source: (args.source ?? 'manual') as 'ai' | 'manual' | 'imported',
            prompt: args.prompt
          });

          return formatSession(session);
        }
      }
    }
  });

  return new GraphQLSchema({ query: queryType, mutation: mutationType });
}
