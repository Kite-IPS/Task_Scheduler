import React, { useState, useEffect, useContext } from 'react'
import BaseLayout from '../../Components/Layouts/BaseLayout';
import { Plus, Eye, House, Activity, X } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import axiosInstance from "../../Utils/axiosInstance";
import { API_PATH } from "../../Utils/apiPath";
import { UserContext } from "../../Context/userContext";

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const isAdmin = user?.role === 'admin' || user?.is_superuser;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState({
    total_task: 0,
    completed_task: 0,
    ongoing_task: 0
  });
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignee: [],
    status: "pending",
    priority: "medium",
    dueDate: "",
    createdBy: "",
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const statuses = [
    { code: "pending", name: "Pending" },
    { code: "completed", name: "Completed" },
    { code: "overdue", name: "Overdue" }
  ];
  const priorities = [
    { code: "low", name: "Low" },
    { code: "medium", name: "Medium" },
    { code: "high", name: "High" },
    { code: "urgent", name: "Urgent" }
  ];
  const departments = [
    { code: "CSE", name: "CSE" },
    { code: "ECE", name: "ECE" },
    { code: "AIDS", name: "AIDS" },
    { code: "CSBS", name: "CSBS" },
    { code: "MECH", name: "MECH" },
    { code: "IT", name: "IT" },
    { code: "CYS", name: "CYS" },
    { code: "AIML", name: "AIML" },
    { code: "RA", name: "R&A" },
  ];

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const response = await axiosInstance.get(API_PATH.TASK.DASHBOARD);
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const response = await axiosInstance.get(API_PATH.USER.ALL);
        
        // Filter to show only faculty and hod roles (exclude staff)
        const filteredUsers = (response.data.users || []).filter(
          (user) => user.role === "faculty" || user.role === "hod"
        );
        setUsers(filteredUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };

    const fetchRecentActivities = async () => {
      try {
        const response = await axiosInstance.get(API_PATH.TASK.HISTORY);
        setRecentActivities(response.data.activities || []);
      } catch (error) {
        console.error('Error fetching recent activities:', error);
        setRecentActivities([]);
      }
    };

    fetchDashboardStats();
    fetchUsers();
    fetchRecentActivities();
  }, []);

  // Filter users based on selected department
  const getFilteredUsers = () => {
    if (departmentFilter === "all") {
      return users;
    }
    return users.filter((user) => user.department === departmentFilter);
  };

  const openCreateModal = () => {
    setFormData({
      title: "",
      description: "",
      assignee: [],
      status: "pending",
      priority: "medium",
      dueDate: "",
      createdBy: currentUser?.email || "",
    });
    setDepartmentFilter("all");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      title: "",
      description: "",
      assignee: [],
      status: "pending",
      priority: "medium",
      dueDate: "",
      createdBy: "",
    });
    setDepartmentFilter("all");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssigneeToggle = (email) => {
    setFormData(prev => {
      const isSelected = prev.assignee.includes(email);
      const newAssignees = isSelected
        ? prev.assignee.filter(e => e !== email)
        : [...prev.assignee, email];
      return { ...prev, assignee: newAssignees };
    });
  };

  const getSelectedDepartments = () => {
    if (!formData.assignee || formData.assignee.length === 0) return '';
    const departments = formData.assignee.map(email => {
      const user = users.find(u => u.email === email);
      return user?.department?.toUpperCase();
    }).filter(Boolean);
    return [...new Set(departments)].join(', ');
  };

  const handleCreateTask = async () => {
    if (
      formData.title &&
      formData.description &&
      formData.assignee &&
      formData.assignee.length > 0 &&
      formData.dueDate
    ) {
      setCreateLoading(true);
      try {
        // Get departments for selected assignees
        const selectedDepartments = formData.assignee.map(email => {
          const user = users.find(u => u.email === email);
          return user?.department;
        }).filter(Boolean);

        if (selectedDepartments.length === 0) {
          alert("Selected users don't have departments assigned. Please select different users.");
          setCreateLoading(false);
          return;
        }

        const taskData = {
          title: formData.title,
          description: formData.description,
          assignee: formData.assignee, // Array of emails
          department: [...new Set(selectedDepartments)], // Unique departments
          priority: formData.priority || 'medium',
          status: formData.status || 'pending',
          due_date: formData.dueDate,
          created_by: formData.createdBy || currentUser?.email || ""
        };

        const response = await axiosInstance.post(API_PATH.TASK.CREATE, taskData);
        
        console.log("Task created successfully:", response.data);
        
        // Refresh dashboard stats after creating a task
        const statsResponse = await axiosInstance.get(API_PATH.TASK.DASHBOARD);
        setStats(statsResponse.data);
        
        // Refresh recent activities
        const activitiesResponse = await axiosInstance.get(API_PATH.TASK.HISTORY);
        setRecentActivities(activitiesResponse.data.activities || []);
        
        closeModal();
        
        // Show success message with alert
        alert("Task created successfully!");
      } catch (error) {
        console.error("Error creating task:", error);
        const errorMessage = error.response?.data?.detail || 
                           error.response?.data?.message || 
                           error.response?.data?.error ||
                           error.message ||
                           "Unknown error occurred";
        alert("Error creating task: " + errorMessage);
      } finally {
        setCreateLoading(false);
      }
    } else {
      alert("Please fill all required fields");
    }
  };

  return (
    <BaseLayout>
      <div className="flex gap-1 items-center my-4 w-[90%] md:w-[80%] mx-auto text-white/70">
        <button
          className="hover:text-red-400 cursor-pointer transition-colors"
          onClick={() => navigate(isAdmin ? "/admin-panel/dashboard" : "/faculty/dashboard")}
        >
          <House />
        </button>
        <span>{">"}"</span>
        <button
          className="hover:text-red-400 cursor-pointer transition-colors"
          onClick={() => navigate(isAdmin ? "/admin-panel/create-task" : "/faculty/dashboard")}
        >
          {isAdmin ? "Create Task" : "Dashboard"}
        </button>
      </div>

      {/* Stats Cards - 2 cards in first row on mobile, third card below */}
      <div className="w-[90%] md:w-[80%] mx-auto grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 my-10">
        <div className="h-[100px] md:h-auto flex flex-col justify-center py-0 md:py-8 px-4 md:px-10 text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl cursor-pointer hover:scale-105 hover:bg-white/10 transition-all shadow-lg hover:shadow-2xl">
          <h2 className="font-semibold mb-3 text-white/80 text-[17px] md:text-xl">Total Assigned Tasks</h2>
          <p className="font-bold text-green-400 text-[18px] md:text-5xl">
            {loading ? '...' : stats.total_task}
          </p>
        </div>
        <div className="h-[100px] md:h-auto flex flex-col justify-center py-0 md:py-8 px-4 md:px-10 text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl cursor-pointer hover:scale-105 hover:bg-white/10 transition-all shadow-lg hover:shadow-2xl">
          <h2 className="font-semibold mb-3 text-white/80 text-[17px] md:text-xl">Completed Tasks</h2>
          <p className="font-bold text-blue-400 text-[18px] md:text-5xl">
            {loading ? '...' : stats.completed_task}
          </p>
        </div>
        <div className="h-[60px] md:h-auto md:pt-8 flex md:flex-col md:justify-start items-center md:items-start justify-between px-4 md:px-10 text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl cursor-pointer hover:scale-105 hover:bg-white/10 transition-all shadow-lg hover:shadow-2xl col-span-2 lg:col-span-1">
          <h2 className="font-semibold text-white/80 text-[17px] md:text-xl mb-3">Pending Tasks</h2>
          <p className="font-bold text-orange-400 text-[18px] md:text-5xl">
            {loading ? '...' : stats.ongoing_task}
          </p>
        </div>
      </div>

      {/* Action Buttons - Equal width on mobile, centered on desktop */}
      <div className="w-[90%] md:w-[80%] mx-auto my-8">
        <div className="flex flex-row justify-center items-center gap-4 md:gap-6 flex-wrap md:flex-nowrap">
          <button
            className="w-auto bg-white/10 backdrop-blur-md border border-white/20 hover:bg-red-600 hover:border-red-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-medium text-base md:text-lg shadow-lg hover:shadow-xl hover:scale-105"
            onClick={openCreateModal}
          >
            <Plus className="w-5 h-5" />
            Create Task
          </button>
          <button
            className="w-auto bg-white/10 backdrop-blur-md border border-white/20 hover:bg-red-600 hover:border-red-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-medium text-base md:text-lg shadow-lg hover:shadow-xl hover:scale-105"
            onClick={() => navigate(isAdmin ? "/admin-panel/tasks" : "/faculty/assign")}
          >
            <Eye className="w-5 h-5" />
            View All
          </button>
        </div>
      </div>

      {/* Recent Activity Tab - Improved width and hover effects */}
      <div className="w-[90%] md:w-[80%] mx-auto my-8 mb-12">
        <div className="bg-white/5 backdrop-blur-md rounded-xl md:rounded-2xl shadow-xl border border-white/10 overflow-hidden">
          {/* Tab Header */}
          <div className="bg-white/10 backdrop-blur-sm px-4 md:px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-red-400" />
              <h2 className="text-base md:text-xl font-semibold text-white">Recent Activity</h2>
            </div>
          </div>

          {/* Activity Content */}
          <div className="p-4 md:p-6">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm md:text-base">No recent activities</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 py-3 md:py-4 px-3 md:px-5 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 hover:bg-white/10 hover:border-white/20 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex-1">
                      <div className="text-sm md:text-base text-white/90 font-medium">
                        <span className="text-red-400">{activity.action_display}</span> - {activity.task_title}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        by {activity.performed_by_name}
                      </div>
                    </div>
                    <span className="text-xs md:text-sm text-red-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 font-medium whitespace-nowrap w-fit">
                      {new Date(activity.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-[90%] md:w-[600px] p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Create Task</h2>
              <button onClick={closeModal} className="text-white/70 hover:text-white transition">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40"
                    placeholder="Enter task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40 resize-none"
                    placeholder="Enter task description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">Created By</label>
                  <input
                    type="text"
                    name="createdBy"
                    value={formData.createdBy}
                    onChange={handleInputChange}
                    className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40"
                    placeholder="Enter the name of the person creating this task"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    Assignee(s) * {formData.assignee.length > 0 && `(${formData.assignee.length} selected)`}
                  </label>

                  {/* Department Filter Dropdown */}
                  <div className="mb-3">
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
                    >
                      <option value="all" className="bg-gray-900">
                        All Departments
                      </option>
                      {departments.map((dept) => (
                        <option key={dept.code} value={dept.code} className="bg-gray-900">
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg p-3 max-h-60 overflow-y-auto">
                    {usersLoading ? (
                      <p className="text-white/60 text-sm">Loading users...</p>
                    ) : getFilteredUsers().length === 0 ? (
                      <p className="text-white/60 text-sm">No users available in this department</p>
                    ) : (
                      <div className="space-y-2">
                        {getFilteredUsers().map((user) => (
                          <label
                            key={user.id}
                            className="flex items-start gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={formData.assignee.includes(user.email)}
                              onChange={() => handleAssigneeToggle(user.email)}
                              className="mt-1 w-4 h-4 rounded border-white/20 bg-white/10 text-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0"
                            />
                            <div className="flex-1">
                              <div className="text-white text-sm font-medium">{user.name || user.email}</div>
                              <div className="text-white/60 text-xs">
                                {user.email} • {user.role} {user.department && `• ${user.department.toUpperCase()}`}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.assignee.length > 0 && (
                    <div className="mt-2 text-xs text-white/80 bg-white/5 p-2 rounded border border-white/10">
                      <span className="font-semibold">Auto-selected Departments:</span>{" "}
                      {getSelectedDepartments() || "None"}
                    </div>
                  )}
                  <p className="text-xs text-white/60 mt-1">
                    Select one or more assignees (Faculty/HOD only). Departments will be automatically set based on selected assignees.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-white/90 mb-1">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
                    >
                      {statuses.map((status) => (
                        <option key={status.code} value={status.code} className="bg-gray-900">
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-white/90 mb-1">Priority</label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
                    >
                      {priorities.map((priority) => (
                        <option key={priority.code} value={priority.code} className="bg-gray-900">
                          {priority.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-white/90 mb-1">Due Date *</label>
                    <input
                      type="datetime-local"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-white/20 bg-white/5 rounded-lg hover:bg-white/10 transition font-medium text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={createLoading}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition font-medium ${
                    createLoading
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </>
          </div>
        </div>
      )}
    </BaseLayout>
  )
}

export default FacultyDashboard