from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta
from dateutil import parser

app = Flask(__name__)

tasks = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    task = request.json
    task['id'] = len(tasks) + 1
    
    # Ensure dependencies is always a list
    if 'dependencies' not in task:
        task['dependencies'] = []
    
    tasks.append(task)
    return jsonify(task)

@app.route('/api/reset', methods=['POST'])
def reset_tasks():
    global tasks
    tasks = []
    return jsonify({"message": "All tasks cleared"})

@app.route('/api/calculate', methods=['POST'])
def calculate_dates():
    project_start = parser.parse(request.json['projectStart'])
    sorted_tasks = sorted(tasks, key=lambda x: (x['major'], x['minor']))
    
    for i in range(len(sorted_tasks)):
        major_value = sorted_tasks[i]['major']
        minor_value = sorted_tasks[i]['minor']
        
        if minor_value == 0:
            if major_value == 1:
                start_date = project_start
            else:
                previous_milestone_end_date = project_start
                for j in range(i):
                    if sorted_tasks[j]['major'] == (major_value - 1):
                        task_end_date = parser.parse(sorted_tasks[j]['endDate'])
                        if task_end_date > previous_milestone_end_date:
                            previous_milestone_end_date = task_end_date
                start_date = previous_milestone_end_date
            
            sorted_tasks[i]['startDate'] = start_date.isoformat()
            sorted_tasks[i]['endDate'] = (start_date + timedelta(days=sorted_tasks[i]['duration'])).isoformat()
        
        else:
            previous_minor_value = sorted_tasks[i - 1]['minor']
            
            if sorted_tasks[i]['minor'] == previous_minor_value:
                start_date = parser.parse(sorted_tasks[i - 1]['startDate'])
                sorted_tasks[i]['startDate'] = start_date.isoformat()
                sorted_tasks[i]['endDate'] = (start_date + timedelta(days=sorted_tasks[i]['duration'])).isoformat()
            
            elif sorted_tasks[i]['minor'] > previous_minor_value:
                max_end_date_among_previous_minor = project_start
                for j in range(i):
                    if (sorted_tasks[j]['major'] == sorted_tasks[i]['major'] and 
                        sorted_tasks[j]['minor'] == (sorted_tasks[i]['minor'] - 1)):
                        task_end_date = parser.parse(sorted_tasks[j]['endDate'])
                        if task_end_date > max_end_date_among_previous_minor:
                            max_end_date_among_previous_minor = task_end_date
                
                sorted_tasks[i]['startDate'] = max_end_date_among_previous_minor.isoformat()
                sorted_tasks[i]['endDate'] = (max_end_date_among_previous_minor + 
                                            timedelta(days=sorted_tasks[i]['duration'])).isoformat()
    
    # Update the global tasks list
    for i, task in enumerate(sorted_tasks):
        tasks[i].update(task)
    
    return jsonify(sorted_tasks)

if __name__ == '__main__':
    # Only use debug mode in development
    app.run(host='0.0.0.0', port=10000)
