import React, { useEffect, useState } from 'react';
import axios from 'axios';
import JobDetailsForm from './JobDetailsForm';

const RequestSection = () => {
    const [requests, setRequests] = useState([]);
    const [students, setStudents] = useState({});
    const [disabledStudents, setDisabledStudents] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [companyWalletAddress, setCompanyWalletAddress] = useState('');

    useEffect(() => {
        const fetchCompanyWalletAddress = async () => {
            const companyId = localStorage.getItem('companyId');
            try {
                const response = await axios.get('/api/getCompanyProfile', { params: { companyId } });
                setCompanyWalletAddress(response.data.wallet_address);
            } catch (error) {
                console.error('Error fetching company wallet address', error);
            }
        };
        fetchCompanyWalletAddress();
    }, []);

    useEffect(() => {
        const fetchRequests = async () => {
            const companyId = localStorage.getItem('companyId');
            if (!companyId) {
                setError('No companyId found');
                return;
            }

            setIsLoading(true);
            try {
                const response = await axios.get(`/api/getJobApplications?companyId=${companyId}`);
                const applications = response.data.data;

                // Fetch student info for each application
                const studentPromises = applications.map(app =>
                    axios.get(`/api/getStudentInfoById?studentId=${app.studentId}`)
                        .then(response => ({ id: app.studentId, data: response.data }))
                        .catch(() => ({ id: app.studentId, data: null }))
                );

                const studentsInfo = await Promise.all(studentPromises);
                const studentsMap = studentsInfo.reduce((acc, curr) => {
                    acc[curr.id] = curr.data;
                    return acc;
                }, {});

                setRequests(applications);
                setStudents(studentsMap);
            } catch (error) {
                console.error('Error fetching requests', error);
                setError('Failed to fetch requests. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchRequests();
    }, []);

    const sendInvite = async (studentWalletAddress, studentId, jobDetails) => {

        const companyId = localStorage.getItem('companyId');
        console.log(companyId)

        if (disabledStudents[studentId]) {
            return; // Do not send offer if the student is disabled
        }

        // Fetch company details
        let companyDetails;
        try {
            const companyResponse = await axios.get('/api/getCompanyProfile', { params: { companyId } });
            companyDetails = companyResponse.data;
        } catch (error) {
            console.error('Error fetching company details', error);
            return; // Exit if company details cannot be fetched
        }

        // Prepare the invite data, including company details
        const inviteData = {
            recipientWalletAddress: studentWalletAddress,
            senderWalletAddress: companyWalletAddress,
            message: 'You have received a job offer',
            jobType: jobDetails.jobType,
            position: jobDetails.position,
            jobDescription: jobDetails.jobDescription,
            salary: jobDetails.salary,
            // Include additional company details
            companyName: companyDetails.name,
            companyEmail: companyDetails.email,
            companyAddress: companyDetails.address,
            companyPhone: companyDetails.phone,
            companyProfilePicture: companyDetails.profile_picture,
            companyWalletAddress: companyDetails.wallet_address
        };

        try {
            const response = await axios.post('/api/createInvite', inviteData);
            if (response.data.success) {
                console.log('invite sent successfully');
            } else {
                console.warn('invite could not be sent:', response.data.message);
            }
        } catch (error) {
            console.error('Error sending invite', error);
        }
        setDisabledStudents(prev => ({ ...prev, [studentId]: true }));
    };

    const handleSendInviteClick = (student) => {
        setSelectedStudent(student);
        setIsFormOpen(true);
    };

    const handleSubmitJobDetails = async (jobDetails) => {
        setIsFormOpen(false); // Close the modal

        if (selectedStudent) {
            // Proceed to send the invite
            await sendInvite(selectedStudent.walletAddress, selectedStudent.id, jobDetails);
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-10">Job Applications</h1>
            {requests.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {requests.map((request) => (
                        <div key={request.id} className="bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 ease-in-out">
                            <div className="p-6 space-y-2">
                                <img src={students[request.studentId]?.imageURL || 'default-profile-pic-url'} alt="Profile" className="w-16 h-16 rounded-full mx-auto" />
                                <h3 className="text-lg font-semibold text-indigo-600">Status: <span className="text-gray-600 font-normal">{request.status}</span></h3>
                                <p><span className="font-medium">Name:</span> {students[request.studentId]?.FirstName} {students[request.studentId]?.LastName}</p>
                                <p><span className="font-medium">Email:</span> {students[request.studentId]?.email}</p>
                                <p><span className="font-medium">Wallet Address:</span> {students[request.studentId]?.walletAddress}</p>
                                <p><span className="font-medium">Cover Letter:</span> {request.coverLetter}</p>
                                <p><span className="font-medium">Application Date:</span> {request.applicationDate}</p>
                                <p><span className="font-medium">Experience:</span> {request.experience} years</p>
                                <p><span className="font-medium">Job ID:</span> {request.jobId}</p>
                                <button
                                    onClick={() => handleSendInviteClick({ walletAddress: students[request.studentId]?.walletAddress, id: request.studentId })}
                                    className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                                    Send Offer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-800">No job applications found.</div>
            )}
            {isFormOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="my-modal">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <JobDetailsForm onSubmit={handleSubmitJobDetails} onCancel={() => setIsFormOpen(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequestSection;
