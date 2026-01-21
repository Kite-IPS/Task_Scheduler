import React, { useState, useMemo, useEffect } from "react";
import { Plus, Edit, Trash2, X, Home } from "lucide-react";
import BaseLayout from "../../Components/Layouts/BaseLayout";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../Utils/axiosInstance";
import { API_PATH } from "../../Utils/apiPath";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    department: "",
    email: "",
    password: "",
  });

  const roles = ["admin", "staff", "hod", "faculty"];
  const departments = ["CSE", "IT", "AIDS", "MECH","CSBS","S&H", "ECE", "AIML", "CYS", "RA", "OFFICE", "IQSC", "OTHERS","MBA","INNOVATION TEAM","PLACEMENT"];

  const navigate = useNavigate();

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_PATH.USER.ALL);
        const usersData = response.data.users || [];
        setUsers(usersData);
        setFilteredUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
        alert('Failed to fetch users. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

    // Filter users
    useEffect(() => {
    let filtered = users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "All" || user.role === roleFilter;
      const matchesDept =
        departmentFilter === "All" || user.department === departmentFilter;

      return matchesSearch && matchesRole && matchesDept;
    });

    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [searchTerm, roleFilter, departmentFilter, users]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Modal functions
  const openCreateModal = () => {
    setModalMode("create");
    setFormData({ name: "", role: "", department: "", email: "", password: "" });
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const openViewModal = (user) => {
    setModalMode("view");
    setSelectedUser(user);
    setFormData(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ name: "", role: "", department: "", email: "", password: "" });
    setSelectedUser(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async () => {
    // Password is required for all roles except faculty
    const passwordRequired = formData.role.toLowerCase() !== 'faculty';
    
    if (
      formData.name &&
      formData.role &&
      formData.email &&
      (passwordRequired ? formData.password : true)
    ) {
      try {
        const response = await axiosInstance.post(API_PATH.USER.CREATE, formData);
        
        // Add the new user to local state
        const newUser = response.data.user || response.data;
        setUsers([...users, newUser]);
        
        alert('User created successfully!');
        closeModal();
      } catch (error) {
        console.error('Error creating user:', error);
        alert(error.response?.data?.message || 'Failed to create user. Please try again.');
      }
    } else {
      alert(passwordRequired ? "Please fill all required fields (Name, Email, Role, and Password)" : "Please fill all required fields (Name, Email, and Role)");
    }
  };

  const handleUpdateUser = async () => {
    if (
      formData.name &&
      formData.role &&
      formData.email
    ) {
      try {
        // API call to update user
        await axiosInstance.put(API_PATH.USER.UPDATE(selectedUser.id), formData);
        
        // Update local state after successful API call
        setUsers(users.map((u) => (u.id === selectedUser.id ? { ...selectedUser, ...formData } : u)));
        
        alert('User updated successfully!');
        closeModal();
      } catch (error) {
        console.error('Error updating user:', error);
        alert(error.response?.data?.message || 'Failed to update user. Please try again.');
      }
    } else {
      alert("Please fill required fields (Name, Role, and Email)");
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        // API call to delete user
        await axiosInstance.delete(API_PATH.USER.DELETE(id));
        
        // Update local state after successful API call
        setUsers(users.filter((u) => u.id !== id));
        
        alert('User deleted successfully!');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert(error.response?.data?.message || 'Failed to delete user. Please try again.');
      }
    }
  };

  // Role and department badge colors
  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: "bg-red-500/20 text-red-300 border-red-500/30",
      staff: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      hod: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      faculty: "bg-green-500/20 text-green-300 border-green-500/30",
    };
    return colors[role] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
  };

  const getDepartmentBadgeColor = (dept) => {
    const colors = {
      CSE: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
      IT: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      AIDS: "bg-pink-500/20 text-pink-300 border-pink-500/30",
      MECH: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      ECE: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      AIML: "bg-teal-500/20 text-teal-300 border-teal-500/30",
      CYS: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      RA: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      OFFICE: "bg-slate-500/20 text-slate-300 border-slate-500/30",
      IQSC: "bg-violet-500/20 text-violet-300 border-violet-500/30",
      OTHERS: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    };
    return colors[dept] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
  };

  return (
    <BaseLayout>
      <div className="w-[90%] md:w-[80%] mx-auto py-6">
        {/* Breadcrumb */}
        <div className="flex gap-1 items-center my-4 text-white/70">
          <button 
            className="hover:text-red-400 cursor-pointer transition-colors"
            onClick={() => navigate('/admin-panel/dashboard')}
          >
            <Home size={20} />
          </button>
          <span>{">"}</span>
          <button className="hover:text-red-400 cursor-pointer transition-colors" onClick={() => navigate('/admin-panel/dashboard')}>
            Dashboard
          </button>
          <span>{">"}</span>
          <button className="hover:text-red-400 cursor-pointer transition-colors" onClick={() => navigate('/admin-panel/users')}>
            Users
          </button>
        </div>

        {/* Header with Create Button */}
        <div className="flex justify-between items-center my-6">
          <h1 className="text-2xl font-bold text-white">Users Management</h1>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-red-600 hover:border-red-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:scale-105"
          >
            <Plus size={20} />
            Create User
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40 col-span-1 md:col-span-2"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
            >
              <option value="All" className="bg-gray-900">All Roles</option>
              {roles.map((role) => (
                <option key={role} value={role} className="bg-gray-900">
                  {role}
                </option>
              ))}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
            >
              <option value="All" className="bg-gray-900">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept} className="bg-gray-900">
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-12">
            <div className="text-center text-white/70">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
              <p>Loading users...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                      S.No
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">
                      Email
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-white/80">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {user.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        <span className="capitalize">{user.role}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80">
                        {user.department || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/70">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => openViewModal(user)}
                            className="text-green-400 hover:text-green-300 transition p-1 hover:bg-white/5 rounded"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-400 hover:text-red-300 transition p-1 hover:bg-white/5 rounded"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && !loading && (
                <div className="text-center py-8 text-white/50">
                  No users found. Try adjusting your filters.
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredUsers.length > 0 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg transition-all ${
                      currentPage === page
                        ? "bg-red-600 text-white border border-red-500"
                        : "border border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-[90%] md:w-[500px] p-6">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                {modalMode === "create" ? "Create User" : "View/Edit User"}
              </h2>
              <button
                onClick={closeModal}
                className="text-white/70 hover:text-white transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40"
                  placeholder="Enter user name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40"
                  placeholder="Enter email"
                />
              </div>

              {modalMode === "create" && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    Password {formData.role.toLowerCase() !== 'faculty' && <span className="text-red-400">*</span>}
                  </label>
                  {formData.role.toLowerCase() === 'faculty' ? (
                    <p className="text-white/50 text-sm italic py-2">Faculty members don't require a password (they cannot login)</p>
                  ) : (
                    <input
                      type="text"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white placeholder-white/40"
                      placeholder="Enter password"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  Role <span className="text-red-400">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role.toLowerCase()}
                  onChange={handleInputChange}
                  className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
                >
                  <option value="" className="bg-gray-900">Select Role</option>
                  {roles.map((role) => (
                    <option key={role} value={role} className="bg-gray-900">
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department || ""}
                  onChange={handleInputChange}
                  className="w-full border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-white"
                >
                  <option value="" className="bg-gray-900">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept} className="bg-gray-900">
                      {dept}
                    </option>
                  ))}
                </select>
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
                onClick={
                  modalMode === "create" ? handleCreateUser : handleUpdateUser
                }
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
              >
                {modalMode === "create" ? "Create" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </BaseLayout>
  );
};

export default Users;