import { LightningElement, track } from 'lwc';

import getTaskDashboard
    from '@salesforce/apex/TaskDashboardController.getTaskDashboard';

import completeTask
    from '@salesforce/apex/TaskDashboardController.completeTask';

import { ShowToastEvent }
    from 'lightning/platformShowToastEvent';


export default class TaskDashboard extends LightningElement {

    // =========================================================
    // DATA
    // =========================================================

    @track overdueTasks = [];
    @track todayTasks = [];
    @track tomorrowTasks = [];

    @track selectedTask = null;


    // =========================================================
    // UI STATE
    // =========================================================

    showTaskModal = false;
    showCompletionInput = false;

    completionComments = '';

    isCompleting = false;
    isLoading = false;

    activeTab = 'TODAY';


    // =========================================================
    // LIFECYCLE
    // =========================================================

    connectedCallback() {
        this.loadTaskDashboard();
    }


    // =========================================================
    // LOAD TASKS
    // =========================================================

    async loadTaskDashboard() {

        this.isLoading = true;

        try {

            const result = await getTaskDashboard();

            this.overdueTasks = this.formatTasks(
                result?.overdueTasks || []
            );

            this.todayTasks = this.formatTasks(
                result?.todayTasks || []
            );

            this.tomorrowTasks = this.formatTasks(
                result?.tomorrowTasks || []
            );

            console.log(
                'Overdue:',
                this.overdueTasks.length
            );

            console.log(
                'Today:',
                this.todayTasks.length
            );

            console.log(
                'Tomorrow:',
                this.tomorrowTasks.length
            );

        } catch (error) {

            console.error(
                'Dashboard Error:',
                error
            );

            this.showToast(
                'Error',
                this.getErrorMessage(error),
                'error'
            );

            this.overdueTasks = [];
            this.todayTasks = [];
            this.tomorrowTasks = [];

        } finally {

            this.isLoading = false;
        }
    }


    // =========================================================
    // FORMAT TASKS
    // =========================================================

    formatTasks(taskList) {

        return taskList.map(task => {

            return {
                ...task,

                // Task URL
                taskUrl: `/${task.Id}`,

                taskIdDisplay: task.Id,

                // Name - Lead / Contact
                nameValue:
                    task.Who?.Name ||
                    'Not specified',

                nameUrl:
                    task.WhoId
                        ? `/${task.WhoId}`
                        : null,

                // Related To
                relatedToName:
                    task.What?.Name ||
                    'Not specified',

                relatedToUrl:
                    task.WhatId
                        ? `/${task.WhatId}`
                        : null,

                // Owner
                ownerName:
                    task.Owner?.Name ||
                    'Unknown',

                // Date
                formattedDate:
                    this.formatDate(
                        task.ActivityDate
                    ),

                // Priority CSS
                priorityClass:
                    this.getPriorityClass(
                        task.Priority
                    )
            };
        });
    }


    // =========================================================
    // COUNTS
    // =========================================================

    get overdueCount() {
        return this.overdueTasks.length;
    }

    get todayCount() {
        return this.todayTasks.length;
    }

    get tomorrowCount() {
        return this.tomorrowTasks.length;
    }


    // =========================================================
    // EMPTY STATES
    // =========================================================

    get hasOverdueTasks() {
        return this.overdueTasks.length > 0;
    }

    get hasTodayTasks() {
        return this.todayTasks.length > 0;
    }

    get hasTomorrowTasks() {
        return this.tomorrowTasks.length > 0;
    }


    // =========================================================
    // CURRENT TAB
    // =========================================================

    get currentTasks() {

        switch (this.activeTab) {

            case 'OVERDUE':
                return this.overdueTasks;

            case 'TOMORROW':
                return this.tomorrowTasks;

            case 'TODAY':
            default:
                return this.todayTasks;
        }
    }


    // =========================================================
    // TAB CHANGE
    // =========================================================

    handleTabChange(event) {

        const selectedTab =
            event.target.value;

        if (!selectedTab) {
            return;
        }

        this.activeTab = selectedTab;
    }


    // =========================================================
    // REFRESH
    // =========================================================

    handleRefresh() {
        this.loadTaskDashboard();
    }


    // =========================================================
    // DATE
    // =========================================================

    formatDate(dateValue) {

        if (!dateValue) {
            return 'No due date';
        }

        try {

            return new Intl.DateTimeFormat(
                'en-IN',
                {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }
            ).format(
                new Date(
                    dateValue + 'T00:00:00'
                )
            );

        } catch (error) {

            return dateValue;
        }
    }


    // =========================================================
    // PRIORITY
    // =========================================================

    getPriorityClass(priority) {

        if (priority === 'High') {

            return 'priority-badge high-priority';
        }

        if (priority === 'Low') {

            return 'priority-badge low-priority';
        }

        return 'priority-badge normal-priority';
    }


    // =========================================================
    // OPEN TASK MODAL
    // =========================================================

    openTaskModal(event) {

        const taskId =
            event.currentTarget.dataset.id;

        let task =
            this.overdueTasks.find(
                item => item.Id === taskId
            );

        if (!task) {

            task =
                this.todayTasks.find(
                    item => item.Id === taskId
                );
        }

        if (!task) {

            task =
                this.tomorrowTasks.find(
                    item => item.Id === taskId
                );
        }

        if (!task) {
            return;
        }

        this.selectedTask = task;

        this.showTaskModal = true;

        this.showCompletionInput = false;

        this.completionComments = '';
    }


    // =========================================================
    // CLOSE TASK MODAL
    // =========================================================

    closeTaskModal() {

        if (this.isCompleting) {
            return;
        }

        this.showTaskModal = false;

        this.showCompletionInput = false;

        this.selectedTask = null;

        this.completionComments = '';
    }


    // =========================================================
    // SHOW COMPLETION INPUT
    // =========================================================

    showCompletionComments() {

        this.showCompletionInput = true;
    }


    // =========================================================
    // CANCEL COMPLETION
    // =========================================================

    cancelCompletion() {

        this.showCompletionInput = false;

        this.completionComments = '';
    }


    // =========================================================
    // COMMENTS CHANGE
    // =========================================================

    handleCommentsChange(event) {

        this.completionComments =
            event.target.value;
    }


    // =========================================================
    // COMPLETE TASK
    // =========================================================

    async completeSelectedTask() {

        const textarea =
            this.template.querySelector(
                'lightning-textarea'
            );

        if (
            textarea &&
            !textarea.reportValidity()
        ) {
            return;
        }

        if (
            !this.completionComments ||
            !this.completionComments.trim()
        ) {

            this.showToast(
                'Required',
                'Please enter completion comments.',
                'error'
            );

            return;
        }

        if (!this.selectedTask) {
            return;
        }

        const completedTaskId =
            this.selectedTask.Id;

        const completedTaskSubject =
            this.selectedTask.Subject;

        this.isCompleting = true;

        try {

            await completeTask({

                taskId:
                    completedTaskId,

                completionComments:
                    this.completionComments.trim()
            });


            // Remove task immediately
            this.overdueTasks =
                this.overdueTasks.filter(
                    task =>
                        task.Id !== completedTaskId
                );

            this.todayTasks =
                this.todayTasks.filter(
                    task =>
                        task.Id !== completedTaskId
                );

            this.tomorrowTasks =
                this.tomorrowTasks.filter(
                    task =>
                        task.Id !== completedTaskId
                );


            // Close modal
            this.showTaskModal = false;

            this.showCompletionInput = false;

            this.selectedTask = null;

            this.completionComments = '';


            // Success message
            this.showToast(
                'Task Completed',
                `"${completedTaskSubject}" has been marked as completed.`,
                'success'
            );

        } catch (error) {

            console.error(
                'Complete Task Error:',
                error
            );

            this.showToast(
                'Error',
                this.getErrorMessage(error),
                'error'
            );

        } finally {

            this.isCompleting = false;
        }
    }


    // =========================================================
    // ERROR MESSAGE
    // =========================================================

    getErrorMessage(error) {

        if (error?.body?.message) {

            return error.body.message;
        }

        if (error?.message) {

            return error.message;
        }

        return 'An unexpected error occurred.';
    }


    // =========================================================
    // TOAST
    // =========================================================

    showToast(
        title,
        message,
        variant
    ) {

        this.dispatchEvent(
            new ShowToastEvent({

                title,
                message,
                variant
            })
        );
    }
}