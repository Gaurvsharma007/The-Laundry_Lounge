/**
 * Order Management System for Laundry Service
 * Handles creation, storage, and retrieval of laundry orders
 */
const OrderManager = (function() {
    // Store for orders
    let orders = [];
    
    // Socket.io connection
    let socket = null;
    
    // Format currency
    function formatCurrency(amount) {
        return "$" + parseFloat(amount).toFixed(2);
    }

    // Format date
    function formatDate(date) {
        if (!date) return 'N/A';
        
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(date).toLocaleDateString('en-US', options);
    }

    // Generate a new order ID
    function generateOrderId() {
        const prefix = "LD-";
        const timestamp = Date.now().toString().slice(-4);
        const random = Math.floor(10000 + Math.random() * 90000);
        return `${prefix}${timestamp}${random}`;
    }

    // Save orders to localStorage
    function saveOrders() {
        try {
            // Log before saving
            console.log("Saving orders to localStorage:", orders);
            localStorage.setItem('laundryOrders', JSON.stringify(orders));
            console.log("Orders saved successfully to key 'laundryOrders'");
            return true;
        } catch (error) {
            console.error("Error saving orders to localStorage:", error);
            return false;
        }
    }

    // Load orders from localStorage
    function loadOrders() {
        console.log("Loading orders from localStorage");
        
        try {
            // Check what's in localStorage
            const storedOrders = localStorage.getItem('laundryOrders');
            console.log("Raw stored orders data:", storedOrders);
            
            if (storedOrders) {
                try {
                    const parsedOrders = JSON.parse(storedOrders);
                    console.log("Successfully parsed orders from storage:", parsedOrders);
                    
                    orders = parsedOrders.map(order => {
                        // Convert date strings back to Date objects
                        if (order.createdAt) order.createdAt = new Date(order.createdAt);
                        if (order.expectedDelivery) order.expectedDelivery = new Date(order.expectedDelivery);
                        if (order.pickup && order.pickup.date) order.pickup.date = new Date(order.pickup.date);
                        
                        // Convert status history dates
                        if (order.statusHistory) {
                            Object.keys(order.statusHistory).forEach(key => {
                                order.statusHistory[key] = new Date(order.statusHistory[key]);
                            });
                        }
                        
                        return order;
                    });
                    
                    console.log("Processed orders after loading:", orders);
                } catch (parseError) {
                    console.error("Error parsing stored orders:", parseError);
                    orders = [];
                }
            } else {
                // If no stored orders, start with empty array
                console.log("No stored orders found, starting with empty array");
                orders = [];
            }
        } catch (error) {
            console.error("Error loading orders:", error);
            orders = [];
        }
        
        console.log("Final orders array after loading:", orders.map(o => o?.id || "undefined"));
    }

    // Get order by ID
    function getOrderById(orderId) {
        if (!orderId) {
            console.error("getOrderById: No order ID provided");
            return null;
        }
        
        // Ensure orders are loaded
        if (orders.length === 0) {
            loadOrders();
        }
        
        // Normalize the requested ID
        const normalizedInputId = orderId.toString().trim();
        
        // First try exact match
        let order = orders.find(o => o.id === normalizedInputId);
        
        // If not found, try case-insensitive match
        if (!order) {
            order = orders.find(o => o.id && o.id.toLowerCase() === normalizedInputId.toLowerCase());
        }
        
        // If still not found, try matching with different prefix variants
        if (!order) {
            // Handle prefix variations (LD- vs ORD) 
            if (normalizedInputId.startsWith('LD-')) {
                const ordVariant = 'ORD' + normalizedInputId.substring(3);
                order = orders.find(o => o.id === ordVariant);
            } 
            else if (normalizedInputId.startsWith('ORD')) {
                const ldVariant = 'LD-' + normalizedInputId.substring(3);
                order = orders.find(o => o.id === ldVariant);
            }
            
            // Try to match just the numeric part if still not found
            if (!order) {
                const numericInput = normalizedInputId.replace(/\D/g, '');
                if (numericInput.length > 0) {
                    order = orders.find(o => {
                        if (!o.id) return false;
                        const numericOrderId = o.id.replace(/\D/g, '');
                        return numericOrderId === numericInput;
        });
                }
            }
        }
        
        if (order) {
            console.log(`Found order with ID ${orderId}:`, order);
        } else {
            console.log(`No order found with ID ${orderId}`);
        }
        
        return order;
    }

    // Get all orders
    function getAllOrders() {
        if (orders.length === 0) {
            loadOrders(); // Ensure orders are loaded
        }
        return [...orders]; // Return a copy of the orders array
    }

    // Create a new order
    function createOrder(orderData) {
        // Remove id from orderData to avoid duplication
        const { id: providedId, ...restOfOrderData } = orderData;
        
        // Generate a new order ID if not provided
        const newOrder = {
            id: providedId || generateOrderId(),
            createdAt: new Date(),
            status: 'pending',
            statusHistory: {
                pending: new Date()
            },
            ...restOfOrderData
        };
        
        // Calculate expected delivery if not provided
        if (!newOrder.expectedDelivery) {
            newOrder.expectedDelivery = calculateExpectedDelivery(
                newOrder.services, 
                newOrder.createdAt
            );
        }
        
        // Add to orders array
        orders.push(newOrder);
        
        // Save to localStorage
        saveOrders();
        
        // Send to server via socket.io
        if (socket) {
            socket.emit('createOrder', newOrder);
            console.log("Emitted new order to server via socket:", newOrder.id);
        } else {
            console.warn("Socket not connected. Order saved locally only.");
            // Try to send order to server via REST API
            sendOrderToServer(newOrder);
        }
        
        console.log("New order created:", newOrder);
        return newOrder;
    }

    // Send order to server via REST API
    function sendOrderToServer(order) {
        fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(order)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Server response for new order:', data);
        })
        .catch(error => {
            console.error('Error sending order to server:', error);
        });
    }

    // Update order status
    function updateOrderStatus(orderId, newStatus) {
        const order = getOrderById(orderId);
        
        if (!order) {
            console.error(`Cannot update status: Order ${orderId} not found`);
            return false;
        }
        
        // Update order status
        order.status = newStatus;
        
        // Add to status history
        if (!order.statusHistory) order.statusHistory = {};
        order.statusHistory[newStatus] = new Date();
        
        // Save changes
        saveOrders();
        
        // Send to server via socket.io
        if (socket) {
            socket.emit('updateOrderStatus', { orderId, status: newStatus });
            console.log(`Emitted status update to server via socket: Order ${orderId} status updated to ${newStatus}`);
        } else {
            console.warn("Socket not connected. Order updated locally only.");
            // Try to send update to server via REST API
            sendStatusUpdateToServer(orderId, newStatus);
        }
        
        console.log(`Order ${orderId} status updated to ${newStatus}`);
        return true;
    }

    // Send status update to server via REST API
    function sendStatusUpdateToServer(orderId, status) {
        fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Server response for status update:', data);
        })
        .catch(error => {
            console.error('Error sending status update to server:', error);
        });
    }

    // Calculate expected delivery date based on services
    function calculateExpectedDelivery(services, orderDate) {
        // Default to 2 days from order date
        const date = new Date(orderDate || new Date());
        
        // Add more days for complex services
        if (services && services.length > 0) {
            // Check if any service requires extra time
            const hasComplexServices = services.some(service => 
                service.name?.toLowerCase().includes('dry cleaning') || 
                service.name?.toLowerCase().includes('stain removal')
            );
            
            // Add more time for complex services
            date.setDate(date.getDate() + (hasComplexServices ? 3 : 2));
        } else {
            // Standard 2-day turnaround
            date.setDate(date.getDate() + 2);
        }
        
        return date;
    }

    // Initialize socket connection
    function initSocket() {
        if (typeof io !== 'undefined') {
            // Connect to socket server
            socket = io();
            
            // Listen for order updates from server
            socket.on('orderUpdated', function(updatedOrder) {
                console.log('Received order update from server:', updatedOrder);
                
                // Find and update the order in the local array
                const index = orders.findIndex(o => o.id === updatedOrder.id);
                if (index !== -1) {
                    orders[index] = updatedOrder;
                    saveOrders();
                    
                    // Dispatch custom event for UI components to react
                    const event = new CustomEvent('orderUpdated', { detail: updatedOrder });
                    document.dispatchEvent(event);
                }
            });
            
            // Listen for new orders from server
            socket.on('orderCreated', function(newOrder) {
                console.log('Received new order from server:', newOrder);
                
                // Check if order already exists locally
                const exists = orders.some(o => o.id === newOrder.id);
                if (!exists) {
                    orders.push(newOrder);
                    saveOrders();
                    
                    // Dispatch custom event for UI components to react
                    const event = new CustomEvent('orderCreated', { detail: newOrder });
                    document.dispatchEvent(event);
                }
            });
            
            // When connected, sync local orders with server
            socket.on('connect', function() {
                console.log('Socket connected to server');
                
                // Send any local orders that might not be on the server
                if (orders.length > 0) {
                    socket.emit('syncOrders', orders);
                }
            });
            
            return true;
        } else {
            console.warn('Socket.io not available');
            return false;
        }
    }

    // Public API
    function init() {
        loadOrders();
        initSocket();
        return true;
    }

    // Return public methods
    return {
        init,
        createOrder,
        getOrderById,
        getAllOrders,
        updateOrderStatus,
        formatCurrency,
        formatDate
    };
})();

// Initialize on load (if we're not in a module environment)
if (typeof window !== 'undefined') {
    window.OrderManager = OrderManager;
} 

console.log('orders.js loaded successfully'); 