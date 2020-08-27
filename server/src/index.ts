import "reflect-metadata"
import { __prod__, COOKIE_NAME } from "./constants"
import express from "express"
import { ApolloServer } from "apollo-server-express"
import { buildSchema } from "type-graphql"
import { HelloResolver } from "./resolvers/hello"
import { PostResolver } from "./resolvers/post"
import { UserResolver } from "./resolvers/user"
import Redis from "ioredis"
import session from "express-session"
import connectRedis from "connect-redis"
import cors from "cors"
import { createConnection } from "typeorm"
import { Post } from "./entities/Post"
import { User } from "./entities/User"
import path from "path"
import { Updoot } from "./entities/Updoot"
import { createUserLoader } from "./utils/createUserLoader"
import { createUpdootLoader } from "./utils/createUpdootLoader"

const main = async () => {
	// connect to database
	const conn = await createConnection({
		type: "postgres",
		database: "reddit-clone",
		username: "postgres",
		logging: true,
		synchronize: true,
		migrations: [path.join(__dirname, "./migrations/*")],
		entities: [Post, User, Updoot],
	})

	await conn.runMigrations()

	// await Post.delete({})

	const app = express()

	// make sure the session middleware run before Apollo middleware
	const RedisStore = connectRedis(session)
	const redis = new Redis({
		host: "127.0.0.1",
		port: 6379,
	})

	app.use(
		cors({
			origin: "http://localhost:3000",
			credentials: true,
		})
	)

	app.use(
		session({
			name: COOKIE_NAME,
			store: new RedisStore({
				client: redis,
				// 测试环境，用来减少redis请求，生产环境可以设置ttl
				// disableTTL: true,
				disableTouch: true,
			}),
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
				httpOnly: true,
				sameSite: "lax", // csrf
				secure: __prod__, // cookie only works in https
			},
			saveUninitialized: false,
			secret: "kobebryant",
			resave: false,
		})
	)

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [HelloResolver, PostResolver, UserResolver],
			validate: false,
		}),
		context: ({ req, res }) => ({
			req,
			res,
			redis,
			userLoader: createUserLoader(),
			updootLoader: createUpdootLoader(),
		}),
	})

	apolloServer.applyMiddleware({
		app,
		cors: false,
	})

	app.listen(4000, () => {
		console.log("server started on localhost:4000")
	})
}

main().catch((err) => {
	console.error(err)
})
