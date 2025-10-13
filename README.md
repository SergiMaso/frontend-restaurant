# Restaurant Management System

A professional restaurant management application built with React, TypeScript, and modern web technologies. This system provides comprehensive tools for managing reservations, tables, customers, and restaurant schedules.

## Features

- 📅 **Reservation Management**: Create, edit, and track customer reservations
- 🪑 **Table Management**: Configure restaurant layout and table arrangements
- 👥 **Customer Database**: Maintain customer information and visit history
- ⏰ **Schedule Management**: Set opening hours and manage weekly schedules
- 📊 **Dashboard**: Real-time overview of daily operations
- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui, Radix UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker (optional, for containerized deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd restaurant-management-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Docker Development

1. **Run development environment**
   ```bash
   npm run docker:dev
   ```

2. **Access the application**
   Navigate to `http://localhost:5173`

## Docker Deployment

### Using Docker Compose (Recommended)

#### Development Mode
```bash
# Start development environment with hot reload
docker-compose --profile dev up

# Run in background
docker-compose --profile dev up -d

# Stop development environment
docker-compose --profile dev down
```

#### Production Mode
```bash
# Build and start production environment
docker-compose up

# Run in background
docker-compose up -d

# Stop production environment
docker-compose down

# Rebuild and start (after code changes)
docker-compose up --build
```

### Using Docker Commands

#### Development
```bash
# Build development image
docker build -f Dockerfile.dev -t restaurant-app:dev .

# Run development container
docker run -p 5173:5173 -v $(pwd):/app -v /app/node_modules restaurant-app:dev
```

#### Production
```bash
# Build production image
docker build -t restaurant-app:prod .

# Run production container
docker run -p 3000:80 restaurant-app:prod

# Run in background
docker run -d -p 3000:80 --name restaurant-app restaurant-app:prod
```

### Docker Management Commands

```bash
# View running containers
docker ps

# View logs
docker logs restaurant-app

# Stop container
docker stop restaurant-app

# Remove container
docker rm restaurant-app

# Remove image
docker rmi restaurant-app:prod
```

## Production Deployment

### Manual Build

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Preview the build**
   ```bash
   npm run preview
   ```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container
- `npm run docker:dev` - Run development with Docker
- `npm run docker:prod` - Run production with Docker

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── ...             # Custom components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── pages/              # Page components
├── services/           # API services
└── types/              # TypeScript type definitions
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Add your environment variables here
VITE_API_URL=your_api_url
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository.
