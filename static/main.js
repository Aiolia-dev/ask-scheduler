function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

function updateTaskTable() {
    fetch('/api/tasks')
        .then(response => response.json())
        .then(tasks => {
            const tbody = document.getElementById('taskTable');
            tbody.innerHTML = '';
            
            tasks.forEach(task => {
                // Find dependency task names
                const dependencyNames = task.dependencies
                    ? task.dependencies
                        .map(depId => tasks.find(t => t.id.toString() === depId)?.name)
                        .filter(name => name)
                        .join(', ')
                    : '';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${task.name}</td>
                    <td>${task.duration}</td>
                    <td>${task.major}.${task.minor}</td>
                    <td>${dependencyNames || '-'}</td>
                    <td>${task.startDate ? formatDate(task.startDate) : '-'}</td>
                    <td>${task.endDate ? formatDate(task.endDate) : '-'}</td>
                `;
                tbody.appendChild(row);
            });
        });
}

// Initialize Select2 for dependencies
function initializeDependenciesSelect() {
    $('#taskDependencies').select2({
        theme: 'bootstrap-5',
        width: '100%',
        placeholder: 'Select dependencies',
        allowClear: true,
        closeOnSelect: false
    });
}

// Update dependencies options
function updateDependenciesOptions() {
    const select = $('#taskDependencies');
    select.empty();

    // Get all existing tasks for the current milestone
    fetch('/api/tasks')
        .then(response => response.json())
        .then(tasks => {
            const currentMajor = parseInt(document.getElementById('taskMajor').value);
            const relevantTasks = tasks.filter(t => t.major === currentMajor);

            relevantTasks.forEach(task => {
                const option = new Option(task.name, task.id, false, false);
                select.append(option);
            });
            select.trigger('change');
        });
}

// Calculate minor order based on dependencies
function calculateMinorOrder(dependencies, tasks) {
    if (!dependencies || dependencies.length === 0) return 0;
    
    // Find the maximum minor order among dependencies and add 1
    const dependencyTasks = tasks.filter(t => dependencies.includes(t.id.toString()));
    const maxMinor = Math.max(...dependencyTasks.map(t => t.minor));
    return maxMinor + 1;
}

function addTask() {
    const name = document.getElementById('taskName').value;
    const duration = parseInt(document.getElementById('taskDuration').value);
    const major = parseInt(document.getElementById('taskMajor').value);
    const dependencies = $('#taskDependencies').val();

    if (!name || !duration || !major) {
        alert('Please fill in all required fields');
        return;
    }

    // Get all tasks to calculate minor order
    fetch('/api/tasks')
        .then(response => response.json())
        .then(tasks => {
            const minor = calculateMinorOrder(dependencies, tasks);
            
            const task = {
                name,
                duration,
                major,
                minor,
                dependencies: dependencies || []
            };

            // Create the new task
            return fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(task)
            });
        })
        .then(response => response.json())
        .then(() => {
            // Clear form
            document.getElementById('taskName').value = '';
            document.getElementById('taskDuration').value = '';
            document.getElementById('taskMajor').value = '';
            $('#taskDependencies').val(null).trigger('change');
            
            // Update dependencies options and table
            updateDependenciesOptions();
            updateTaskTable();
        });


}

function calculateDates() {
    const projectStart = document.getElementById('projectStartDate').value;
    
    if (!projectStart) {
        alert('Please set a project start date');
        return;
    }

    fetch('/api/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectStart })
    })
    .then(response => response.json())
    .then(() => {
        updateTaskTable();
    });
}

function resetTasks() {
    if (confirm('Are you sure you want to delete all tasks? This cannot be undone.')) {
        fetch('/api/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(() => {
            // Clear the project start date
            document.getElementById('projectStartDate').value = '';
            // Update table
            updateTaskTable();
        });
    }
}

let ganttChart = null;

function createGanttChart(tasks) {
    if (!tasks || tasks.length === 0) return;

    // Sort tasks by order (major.minor)
    const sortedTasks = [...tasks].sort((a, b) => {
        const orderA = parseFloat(`${a.major}.${a.minor}`);
        const orderB = parseFloat(`${b.major}.${b.minor}`);
        return orderA - orderB;
    });

    // Prepare data for the chart
    const datasets = [];
    const labels = sortedTasks.map(task => task.name);
    
    // Create bars for tasks
    datasets.push({
        label: 'Tasks',
        data: sortedTasks.map(task => ({
            x: [new Date(task.startDate), new Date(task.endDate)],
            y: task.name
        })),
        backgroundColor: '#36A2EB',
        borderColor: '#2196F3',
        borderWidth: 1,
        borderSkipped: false,
        borderRadius: 4
    });

    // If chart exists, destroy it
    if (ganttChart) {
        ganttChart.destroy();
    }

    // Get the earliest and latest dates
    const minDate = new Date(Math.min(...sortedTasks.map(t => new Date(t.startDate))));
    const maxDate = new Date(Math.max(...sortedTasks.map(t => new Date(t.endDate))));

    // Create dependency annotations
    const annotations = {};
    sortedTasks.forEach((task, index) => {
        if (task.minor > 0) {
            // Find tasks in the same milestone with minor - 1
            const dependencies = sortedTasks.filter(t => 
                t.major === task.major && t.minor === task.minor - 1
            );

            dependencies.forEach((depTask, depIndex) => {
                const depTaskIndex = sortedTasks.findIndex(t => t.id === depTask.id);
                // Calculate positions
                const depTaskStart = new Date(depTask.startDate);
                const depTaskEnd = new Date(depTask.endDate);
                const taskStart = new Date(task.startDate);
                
                // Calculate middle points
                const startX = new Date((depTaskStart.getTime() + depTaskEnd.getTime()) / 2);
                const endX = taskStart;
                
                // Calculate vertical positions (middle of the bar height)
                const barHeight = 0.5; // Height of the task bar in chart units
                const startY = depTaskIndex; // Top of predecessor task
                const endY = index; // Top of dependent task
                const startYMiddle = startY + barHeight / 2; // Middle of predecessor task
                const endYMiddle = endY + barHeight / 2; // Middle of dependent task

                // Create curved dependency line
                const curveId = `curve-${task.id}-${depTask.id}`;
                const midX = new Date((startX.getTime() + endX.getTime()) / 2);
                
                // Common line properties
                const lineProps = {
                    type: 'line',
                    borderColor: 'rgba(0, 0, 0, 0.3)',
                    borderWidth: 1.5,
                    borderDash: [3, 3],  // Make lines dashed
                    z: 1
                };

                // First segment - horizontal from start
                const curve1Id = `curve1-${task.id}-${depTask.id}`;
                annotations[curve1Id] = {
                    ...lineProps,
                    xMin: startX,
                    xMax: midX,
                    yMin: startYMiddle,
                    yMax: startYMiddle
                };

                // Second segment - vertical down
                const curve2Id = `curve2-${task.id}-${depTask.id}`;
                annotations[curve2Id] = {
                    ...lineProps,
                    xMin: midX,
                    xMax: midX,
                    yMin: startYMiddle,
                    yMax: endYMiddle
                };

                // Third segment - horizontal to end
                const curve3Id = `curve3-${task.id}-${depTask.id}`;
                annotations[curve3Id] = {
                    ...lineProps,
                    xMin: midX,
                    xMax: endX,
                    yMin: endYMiddle,
                    yMax: endYMiddle
                };

                // Start circle at the middle of predecessor task
                const startCircleId = `start-${task.id}-${depTask.id}`;
                annotations[startCircleId] = {
                    type: 'point',
                    xValue: startX,
                    yValue: startYMiddle,
                    backgroundColor: 'white',
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    borderWidth: 1.5,
                    radius: 3,
                    z: 2
                };

                // End arrow at the start of dependent task
                const endCircleId = `end-${task.id}-${depTask.id}`;
                annotations[endCircleId] = {
                    type: 'point',
                    xValue: endX,
                    yValue: endYMiddle,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    radius: 4,
                    z: 2
                };
            });
        }
    });

    // Create the chart
    const ctx = document.getElementById('ganttCanvas').getContext('2d');
    ganttChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    position: 'top',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM D'
                        }
                    },
                    min: minDate,
                    max: maxDate
                },
                y: {
                    beginAtZero: true,
                    reverse: false
                }
            },
            plugins: {
                annotation: {
                    annotations: annotations
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const task = sortedTasks[context.dataIndex];
                            const start = new Date(task.startDate).toLocaleDateString();
                            const end = new Date(task.endDate).toLocaleDateString();
                            return [`Start: ${start}`, `End: ${end}`, `Duration: ${task.duration} days`];
                        }
                    }
                }
            }
        }
    });
}

function displayGanttChart() {
    fetch('/api/tasks')
        .then(response => response.json())
        .then(tasks => {
            if (tasks.length === 0) {
                alert('Please add some tasks and calculate dates first.');
                return;
            }

            if (!tasks[0].startDate) {
                alert('Please calculate project dates first.');
                return;
            }

            const ganttChart = document.getElementById('ganttChart');
            ganttChart.classList.remove('d-none');
            createGanttChart(tasks);
        });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    updateTaskTable();
    initializeDependenciesSelect();
});

// Update dependencies when major order changes
document.getElementById('taskMajor').addEventListener('change', () => {
    updateDependenciesOptions();
});
