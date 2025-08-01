# CRM & Ecommerce API Server

A combined Node.js API server for CRM and Ecommerce functionality.

## Features

- **CRM Module**: Authentication, profiles, tasks, mentors, members, file uploads
- **Ecommerce Module**: Authentication, products, cart, wishlist, blog, profiles
- **Shared**: Database, utilities, middleware

## API Endpoints

### CRM Routes (`/crm/*`)
- `/crm/auth` - Authentication
- `/crm/profile` - User profiles
- `/crm/task` - Task management
- `/crm/mentor` - Mentor management
- `/crm/member` - Member management
- `/crm/upload` - File uploads

### Ecommerce Routes (`/ecommerce/*`)
- `/ecommerce/auth` - Authentication
- `/ecommerce/profile` - User profiles
- `/ecommerce/products` - Product management
- `/ecommerce/cart` - Shopping cart
- `/ecommerce/wish` - Wishlist
- `/ecommerce/blog` - Blog posts

## Free Deployment Options

### 1. Render (Recommended)
- **Free tier**: 750 hours/month
- **Custom domain**: Yes
- **Auto-deploy**: Yes

**Steps:**
1. Push code to GitHub
2. Connect GitHub repo to Render
3. Set environment variables:
   - `MONGO_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Your JWT secret key
4. Deploy!

### 2. Vercel
- **Free tier**: Generous limits
- **Custom domain**: Yes
- **Serverless**: Yes

**Steps:**
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod`
3. Set environment variables in Vercel dashboard

### 3. Railway
- **Free tier**: $5 credit/month
- **Custom domain**: Yes
- **Auto-deploy**: Yes

**Steps:**
1. Connect GitHub repo to Railway
2. Set environment variables
3. Deploy automatically

## Environment Variables

Create a `.env` file or set in your hosting platform:

```env
NODE_ENV=production
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CRM_DB_NAME=crm
ECOMMERCE_DB_NAME=ecommerce
ALLOWED_ORIGINS=*
```

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Database Setup

1. Create MongoDB Atlas account (free tier available)
2. Create two databases: `crm` and `ecommerce`
3. Get connection string and set as `MONGO_URI`

## File Uploads

Uploads are stored in:
- CRM: `routes/crm/uploads/`
- Ecommerce: `routes/ecommerce/uploads/`

Access via: `/uploads/filename.ext`

## Security Notes

- Set strong `JWT_SECRET`
- Configure `ALLOWED_ORIGINS` for production
- Use HTTPS in production
- Regular database backups recommended
