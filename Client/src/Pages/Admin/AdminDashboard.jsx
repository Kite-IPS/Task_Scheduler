import BaseLayout from "../../Components/Layouts/BaseLayout";
import Table from "../../Components/Admin/Table";
import { Download, House, UsersRound, Eye, X, Activity, List, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import axiosInstance from "../../Utils/axiosInstance";
import { API_PATH } from "../../Utils/apiPath";
import ExcelJS from 'exceljs';
import { UserContext } from "../../Context/userContext";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [stats, setStats] = useState({
    total_task: 0,
    completed_task: 0,
    ongoing_task: 0
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [followComments, setFollowComments] = useState([]);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  
  // Check if user is HOD or Admin - making sure admin sees comments
  const isHOD = user?.role === 'hod';
  // Use both 'admin' role and is_superuser flag to identify admins
  const isAdmin = user?.role === 'admin' || user?.is_superuser === true;
  
  // Log user role for debugging
  useEffect(() => {
    console.log('User data:', user);
    console.log('User role:', user?.role);
    console.log('Is superuser:', user?.is_superuser);
    console.log('Is HOD:', isHOD);
    console.log('Is Admin:', isAdmin);
  }, [user, isHOD, isAdmin]);

  // Export to Excel function
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tasks');

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 5 },
      { header: 'Title', key: 'title', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Assignee(s)', key: 'assignee', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Due Date', key: 'dueDate', width: 12 },
      { header: 'Created Date', key: 'createdDate', width: 12 },
      { header: 'Completed Date', key: 'completedDate', width: 12 }
    ];

    // Get tasks data - handle both response.data.tasks and response.data formats
    const tasksData = data.tasks || data;

    // Add data rows
    tasksData.forEach((task, index) => {
      worksheet.addRow({
        sno: index + 1,
        title: task.title,
        description: task.description,
        assignee: task.assignee || 'Unassigned',
        department: Array.isArray(task.dept) ? task.dept.join(', ') : task.dept,
        status: task.status ? task.status.charAt(0).toUpperCase() + task.status.slice(1) : '',
        priority: task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : '',
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '-',
        createdDate: task.created_at ? new Date(task.created_at).toLocaleDateString() : '-',
        completedDate: task.completed_at ? new Date(task.completed_at).toLocaleDateString() : '-'
      });
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Generate and download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin_tasks_report.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // View task modal functions
  const openViewModal = (task) => {
    setSelectedTask(task);
    setIsViewModalOpen(true);
  };

  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setSelectedTask(null);
  };

  // Reset Password Functions
  const closeResetPasswordModal = () => {
    setIsResetPasswordModalOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Please fill in both password fields");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }

    setResetLoading(true);
    try {
      await axiosInstance.post(API_PATH.USER.RESET_PASSWORD(user.id), {
        password: newPassword
      });
      
      alert("Password reset successfully!");
      closeResetPasswordModal();
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(error.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

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

    const fetchAllTasks = async () => {
      try {
        const response = await axiosInstance.get(API_PATH.TASK.ALL);
        
        // Transform API data to match Table component expectations
        if (response.data.tasks && Array.isArray(response.data.tasks)) {
          const transformedData = response.data.tasks.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description,
            dept: task.department, // Map department to dept
            status: formatStatus(task.status), // Format status to Title Case
            assignee: formatAssignees(task.assignee), // Extract assignee names
            priority: formatPriority(task.priority), // Format priority to Title Case
            created_at: task.created_at,
            completed_at: task.completed_at || null,
            dueDate: task.due_date // Map due_date to dueDate
          }));
          setData(transformedData);
        } else if (Array.isArray(response.data)) {
        setData(response.data);
        } else {
          console.error('Unexpected data structure:', response.data);
          setData([]);
        }
      } catch (error) {
        console.error('Error Fetching In Getting all tasks:', error);
        setData([]);
      }
    };

    const fetchRecentActivities = async () => {
      try {
        // Get recent activities
        const activityResponse = await axiosInstance.get(API_PATH.TASK.HISTORY);
        setRecentActivities(activityResponse.data.activities || []);
        
        // Get follow-up comments for admins and staff (not HODs)
        if (isAdmin || (user?.role === 'staff')) {
          try {
            console.log('Fetching comments for role:', user?.role);
            const commentsResponse = await axiosInstance.get(API_PATH.TASK.COMMENTS);
            console.log('Comments response:', commentsResponse.data);
            setFollowComments(commentsResponse.data.follow_comments || []);
          } catch (commentError) {
            // If there's an error fetching comments, just log it and continue
            console.error('Error fetching follow-up comments:', commentError);
            setFollowComments([]);
          }
        } else {
          console.log('Not fetching comments for role:', user?.role);
          setFollowComments([]);
        }
      } catch (error) {
        console.error('Error fetching recent activities:', error);
        setRecentActivities([]);
        setFollowComments([]);
      }
    };

    fetchDashboardStats();
    fetchAllTasks();
    fetchRecentActivities();
  }, []);

  // Helper function to format status (pending -> Pending, in_progress -> In Progress)
  const formatStatus = (status) => {
    if (!status) return '';
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to format priority (urgent -> Urgent)
  const formatPriority = (priority) => {
    if (!priority) return '';
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  };

  // Helper function to extract assignee names
  const formatAssignees = (assignees) => {
    if (!assignees) return '';
    if (Array.isArray(assignees)) {
      return assignees.map(a => a.full_name || a.email).join(', ');
    }
    return assignees;
  };

  return (
    <BaseLayout>
      <div className="flex gap-1 items-center my-4 w-[90%] md:w-[80%] mx-auto text-white/70">
        <button
          className="hover:text-red-400 cursor-pointer transition-colors"
          onClick={() => navigate("/admin-panel/dashboard")}
        >
          <House />
        </button>
        <span>{">"}</span>
        <button
          className="hover:text-red-400 cursor-pointer transition-colors"
          onClick={() => navigate("/admin-panel/dashboard")}
        >
          Dashboard
        </button>
      </div>
      <div className="w-[90%] md:w-[80%] mx-auto grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6 my-10">
        <div className="h-[100px] md:h-auto flex flex-col justify-center py-4 md:py-10 px-4 md:px-6 text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl cursor-pointer hover:scale-105 hover:bg-white/10 transition-all shadow-lg">
          <h2 className="font-semibold mb-1 text-white/80 text-[17px] md:text-xl">Total Tasks</h2>
          <p className="font-bold text-green-400 text-[18px] md:text-5xl">
            {loading ? '...' : stats.total_task}
          </p>
        </div>
        <div className="h-[100px] md:h-auto flex flex-col justify-center py-4 md:py-10 px-4 md:px-6 text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl cursor-pointer hover:scale-105 hover:bg-white/10 transition-all shadow-lg">
          <h2 className="font-semibold mb-1 text-white/80 text-[17px] md:text-xl">Total Completed Tasks</h2>
          <p className="font-bold text-blue-400 text-[18px] md:text-5xl">
            {loading ? '...' : stats.completed_task}
          </p>
        </div>
        <div className="h-[100px] md:h-auto flex flex-col justify-center py-4 md:py-10 px-4 md:px-6 text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl cursor-pointer hover:scale-105 hover:bg-white/10 transition-all shadow-lg col-span-2 md:col-span-1">
          <h2 className="font-semibold mb-1 text-white/80 text-[17px] md:text-xl">Total On-Going Tasks</h2>
          <p className="font-bold text-orange-400 text-[18px] md:text-5xl">
            {loading ? '...' : stats.ongoing_task}
          </p>
        </div>
      </div>
      <div className="w-[90%] md:w-[80%] mx-auto my-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-white">Tasks Table:</h1>
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-red-600 hover:border-red-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:scale-105 flex items-center justify-center gap-1 text-xs md:text-sm"
            onClick={() => navigate("/admin-panel/tasks")}
          >
            <List className="w-4 h-4" /> Manage Tasks
          </button>
          <button
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-red-600 hover:border-red-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:scale-105 flex items-center justify-center gap-1 text-xs md:text-sm"
            onClick={() => navigate("/admin-panel/users")}
          >
            View Users <UsersRound className="w-4 h-4" />
          </button>
          <button
            className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-yellow-600 hover:border-yellow-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:scale-105 flex items-center justify-center gap-1 text-xs md:text-sm"
            onClick={() => setIsResetPasswordModalOpen(true)}
          >
            <KeyRound className="w-4 h-4" /> Reset Password
          </button>
          <button className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-red-600 hover:border-red-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:scale-105 flex items-center justify-center gap-1 text-xs md:text-sm"
          onClick={exportToExcel}
          >
            Export Data <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="w-[90%] md:w-[80%] mx-auto my-4">
        <Table data={data} onView={openViewModal} />
      </div>

      {/* Recent Activities Section - Only visible for admins and staff */}
      {/* Double-checking to ensure admins see this section regardless of other checks */}
      {(user?.role === 'admin' || user?.is_superuser === true || (!isHOD && user?.role === 'staff')) && (
        <div className="w-[90%] md:w-[80%] mx-auto my-8">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="text-red-400" size={24} />
            <h2 className="text-xl font-bold text-white">Recent Follow-up Comments {isAdmin ? '(Admin View)' : ''}</h2>
          </div>
          
          <div className="grid gap-4">
            {followComments.length > 0 ? (
              followComments.map((comment, index) => (
                <div 
                  key={comment.id || index} 
                  className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg hover:bg-white/10 transition-all"
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-white/70 text-sm">
                      Task: <span className="text-red-400 font-semibold cursor-pointer hover:underline" onClick={() => {
                        const task = data.find(t => t.id === comment.task_id);
                        if (task) openViewModal(task);
                      }}>
                        {comment.task_title || data.find(t => t.id === comment.task_id)?.title || `Task #${comment.task_id}`}
                      </span>
                    </span>
                    <span className="text-white/60 text-xs">
                      {new Date(comment.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white/90 mb-2">{comment.comment}</p>
                  <div className="flex justify-end">
                    <span className="text-blue-400 text-xs">by {comment.performed_by}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
                <p className="text-white/60">No follow-up comments found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Task Modal */}
      {isViewModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-[90%] md:w-[600px] p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Task Details</h2>
              <button
                onClick={closeViewModal}
                className="text-white/70 hover:text-white cursor-pointer transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white/90 mb-1">Title</h3>
                <p className="text-white text-base">{selectedTask.title}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90 mb-1">Description</h3>
                <p className="text-white text-base leading-relaxed bg-white/5 p-4 rounded-lg border border-white/10">
                  {selectedTask.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">Assignee</h3>
                  <p className="text-white">{selectedTask.assignee}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">Department</h3>
                  <p className="text-white">
                    {Array.isArray(selectedTask.dept) ? selectedTask.dept.join(', ') : selectedTask.dept}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">Status</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium inline-block ${
                    selectedTask.status?.toLowerCase() === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    selectedTask.status?.toLowerCase() === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {selectedTask.status}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">Priority</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium inline-block ${
                    selectedTask.priority?.toLowerCase() === 'urgent' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    selectedTask.priority?.toLowerCase() === 'high' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                    selectedTask.priority?.toLowerCase() === 'medium' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}>
                    {selectedTask.priority}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">Due Date</h3>
                  <p className="text-white">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Not set'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">Created Date</h3>
                  <p className="text-white">
                    {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString() : 'Not available'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90 mb-1">Completed Date</h3>
                  <p className="text-white">
                    {selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleDateString() : 'Not completed'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-[90%] md:w-[400px] p-6">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Reset Your Password</h2>
                <p className="text-sm text-white/60 mt-1">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={closeResetPasswordModal}
                className="text-white/70 hover:text-white transition cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40"
                  placeholder="Confirm new password"
                />
              </div>

              <p className="text-xs text-white/50">
                Password must be at least 6 characters long.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeResetPasswordModal}
                className="flex-1 px-4 py-2 border border-white/20 bg-white/5 rounded-lg hover:bg-white/10 transition font-medium text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Resetting...
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    Reset Password
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </BaseLayout>
  );
};

export default AdminDashboard;