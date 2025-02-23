# Task Scheduler

A web application for scheduling project tasks with dependencies and visualizing them in a Gantt chart.

## Features

- Add tasks with duration and dependencies
- Automatically calculate task dates based on dependencies
- Visualize tasks in a Gantt chart
- Track task dependencies and relationships
- Clear visualization of task dependencies with arrows

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   python app.py
   ```

## Production Deployment

The application is configured to run on Render.com with the following specifications:
- Python 3.x
- Gunicorn web server
- Requirements specified in requirements.txt
