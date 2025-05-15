import express, { Request, Response } from 'express';
import { MongoClient }               from 'mongodb';

const fetch = (...args: [any, ...any[]]) => import('node-fetch').then(mod => mod.default(...args)); // ✅ Add this line

const app = express();
app.use(express.json());

const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME   = 'assignmentDB';


interface Geo     { lat: string; lng: string }
interface Address { street:string; suite:string; city:string; zipcode:string; geo:Geo }
interface Company { name:string; catchPhrase:string; bs:string }
interface Comment { id:number; name:string; email:string; body:string }
interface Post    { id:number; title:string; body:string; comments:Comment[] }
interface User    {
  id:number; name:string; username:string; email:string;
  address:Address; phone:string; website:string; company:Company;
  posts:Post[];
}


(async () => {
  const client   = await MongoClient.connect(MONGO_URI);
  const db       = client.db(DB_NAME);
  const users    = db.collection<User>('users');
  const posts    = db.collection<Post>('posts');
  const comments = db.collection<Comment>('comments');

  
  app.get(
    '/load',
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const us = await fetch('https://jsonplaceholder.typicode.com/users')
                              .then(r => r.json()) as User[];
        await users.deleteMany({});
        await posts.deleteMany({});
        await comments.deleteMany({});

        for (const u of us) {
          const ps = await fetch(`https://jsonplaceholder.typicode.com/users/${u.id}/posts`)
                            .then(r => r.json()) as Post[];

          for (const p of ps) {
            const cs = await fetch(`https://jsonplaceholder.typicode.com/posts/${p.id}/comments`)
                              .then(r => r.json()) as Comment[];
            p.comments = cs;
            await comments.insertMany(cs);
            await posts.insertOne(p);
          }

          u.posts = ps;
          await users.insertOne(u);
        }

        res.sendStatus(200);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    }
  );

  
  app.delete(
    '/users',
    async (_req: Request, res: Response): Promise<void> => {
      const { deletedCount } = await users.deleteMany({});
      res.json({ message: `Deleted ${deletedCount} users` });
    }
  );

 
  app.delete(
    '/users/:userId',
    async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
      const result = await users.deleteOne({ id: +req.params.userId });
      if (result.deletedCount) {
        res.json({ message: 'User deleted' });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    }
  );

  
  app.get(
    '/users/:userId',
    async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
      const u = await users.findOne({ id: +req.params.userId });
      if (!u) {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.json(u);
      }
    }
  );

  

  app.put(
    '/users',
    async (req: Request<{}, {}, User>, res: Response): Promise<void> => {
      const newUser = req.body;
      const exists  = await users.findOne({ id: newUser.id });
      if (exists) {
        res.status(400).json({ error: 'User already exists' });
      } else {
        await users.insertOne(newUser);
        res.status(201).json(newUser);
      }
    }
  );

  app.listen(3001, () => console.log('Server listening on http://localhost:3001'));
})();
