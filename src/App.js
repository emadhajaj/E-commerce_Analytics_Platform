// App.js - Replace your existing App.js with this version
import React, { useState, useEffect } from 'react';
import { Package, ShoppingCart, Users, TrendingUp, Database, Plus, Trash2, BarChart3 } from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [apiEndpoint, setApiEndpoint] = useState('https://ovqgzgx7vj.execute-api.us-east-1.amazonaws.com/prod');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: '', price: '', description: '', initial_stock: '' });
  const [newOrder, setNewOrder] = useState({ customer_id: '', items: [{ product_id: '', quantity: 1, price: 0 }] });

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeCustomers: 0
  });

  useEffect(() => {
    if (products.length > 0 || orders.length > 0) {
      setStats({
        totalProducts: products.length,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
        activeCustomers: new Set(orders.map(o => o.customer_id)).size
      });
    }
  }, [products, orders]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        alert('Error fetching products. Check your API endpoint and CORS settings.');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error fetching products. Check your API endpoint.');
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/orders`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      } else {
        alert('Error fetching orders. Check your API endpoint and CORS settings.');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      alert('Error fetching orders. Check your API endpoint.');
    }
    setLoading(false);
  };

  const createProduct = async () => {
    if (!newProduct.name || !newProduct.category || !newProduct.price) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          category: newProduct.category,
          price: parseFloat(newProduct.price),
          description: newProduct.description,
          initial_stock: parseInt(newProduct.initial_stock) || 0
        })
      });
      
      if (response.ok) {
        alert('Product created successfully!');
        setShowProductForm(false);
        setNewProduct({ name: '', category: '', price: '', description: '', initial_stock: '' });
        fetchProducts();
      } else {
        alert('Error creating product. Check console for details.');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Error creating product.');
    }
    setLoading(false);
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/products/${productId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('Product deleted successfully!');
        fetchProducts();
      } else {
        alert('Error deleting product.');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product.');
    }
    setLoading(false);
  };

  const createOrder = async () => {
    if (!newOrder.customer_id || newOrder.items.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: newOrder.customer_id,
          items: newOrder.items.map(item => ({
            product_id: item.product_id,
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price)
          }))
        })
      });
      
      if (response.ok) {
        alert('Order created successfully!');
        setShowOrderForm(false);
        setNewOrder({ customer_id: '', items: [{ product_id: '', quantity: 1, price: 0 }] });
        fetchOrders();
      } else {
        alert('Error creating order. Check console for details.');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Error creating order.');
    }
    setLoading(false);
  };

  const addOrderItem = () => {
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { product_id: '', quantity: 1, price: 0 }]
    });
  };

  const updateOrderItem = (index, field, value) => {
    const items = [...newOrder.items];
    items[index][field] = value;
    setNewOrder({ ...newOrder, items });
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <Database className="header-icon" size={32} />
            <div>
              <h1 className="header-title">E-commerce Analytics Platform</h1>
              <p className="header-subtitle">AWS Cloud Infrastructure</p>
            </div>
          </div>
          <div className="header-right">
            <input
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="API Gateway Endpoint"
              className="api-input"
            />
          </div>
        </div>
      </header>

      <div className="tabs-container">
        <div className="tabs">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'products', label: 'Products', icon: Package },
            { id: 'orders', label: 'Orders', icon: ShoppingCart },
            { id: 'architecture', label: 'Architecture', icon: TrendingUp }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="main-content">
        {activeTab === 'overview' && (
          <div className="content-section">
            <div className="stats-grid">
              {[
                { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'blue' },
                { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'green' },
                { label: 'Total Revenue', value: `$${stats.totalRevenue.toFixed(2)}`, icon: TrendingUp, color: 'purple' },
                { label: 'Active Customers', value: stats.activeCustomers, icon: Users, color: 'orange' }
              ].map((stat, idx) => (
                <div key={idx} className={`stat-card stat-${stat.color}`}>
                  <stat.icon size={32} className="stat-icon" />
                  <p className="stat-value">{stat.value}</p>
                  <p className="stat-label">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <h2 className="card-title">Quick Actions</h2>
              <div className="actions-grid">
                <button onClick={fetchProducts} disabled={loading} className="btn btn-blue">
                  <Package size={20} />
                  {loading ? 'Loading...' : 'Load Products'}
                </button>
                <button onClick={fetchOrders} disabled={loading} className="btn btn-green">
                  <ShoppingCart size={20} />
                  {loading ? 'Loading...' : 'Load Orders'}
                </button>
                <button onClick={() => setShowProductForm(true)} className="btn btn-purple">
                  <Plus size={20} />
                  Create Product
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">Products Management</h2>
              <button onClick={() => setShowProductForm(true)} className="btn btn-blue">
                <Plus size={20} />
                Add Product
              </button>
            </div>

            {showProductForm && (
              <div className="card">
                <h3 className="card-title">New Product</h3>
                <div className="form-grid">
                  <input
                    type="text"
                    placeholder="Product Name *"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Category *"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="input"
                  />
                  <input
                    type="number"
                    placeholder="Price *"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="input"
                  />
                  <input
                    type="number"
                    placeholder="Initial Stock"
                    value={newProduct.initial_stock}
                    onChange={(e) => setNewProduct({ ...newProduct, initial_stock: e.target.value })}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    className="input input-full"
                  />
                </div>
                <div className="form-actions">
                  <button onClick={createProduct} disabled={loading} className="btn btn-blue">
                    {loading ? 'Creating...' : 'Create Product'}
                  </button>
                  <button onClick={() => setShowProductForm(false)} className="btn btn-gray">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="table-empty">
                          No products loaded. Click "Load Products" to fetch data.
                        </td>
                      </tr>
                    ) : (
                      products.map(product => (
                        <tr key={product.product_id}>
                          <td className="table-id">{product.product_id.substring(0, 8)}...</td>
                          <td>{product.product_name}</td>
                          <td>{product.category}</td>
                          <td className="table-price">${product.price}</td>
                          <td>
                            <button onClick={() => deleteProduct(product.product_id)} className="btn-icon btn-danger">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="content-section">
            <div className="section-header">
              <h2 className="section-title">Orders Management</h2>
              <button onClick={() => setShowOrderForm(true)} className="btn btn-green">
                <Plus size={20} />
                Create Order
              </button>
            </div>

            {showOrderForm && (
              <div className="card">
                <h3 className="card-title">New Order</h3>
                <input
                  type="text"
                  placeholder="Customer ID *"
                  value={newOrder.customer_id}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_id: e.target.value })}
                  className="input"
                  style={{marginBottom: '1rem'}}
                />
                
                <div style={{marginBottom: '1rem'}}>
                  <label className="form-label">Order Items</label>
                  {newOrder.items.map((item, idx) => (
                    <div key={idx} className="order-item-row">
                      <input
                        type="text"
                        placeholder="Product ID"
                        value={item.product_id}
                        onChange={(e) => updateOrderItem(idx, 'product_id', e.target.value)}
                        className="input"
                      />
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(idx, 'quantity', e.target.value)}
                        className="input"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => updateOrderItem(idx, 'price', e.target.value)}
                        className="input"
                      />
                    </div>
                  ))}
                  <button onClick={addOrderItem} className="btn-link">
                    + Add Another Item
                  </button>
                </div>
                
                <div className="form-actions">
                  <button onClick={createOrder} disabled={loading} className="btn btn-green">
                    {loading ? 'Creating...' : 'Create Order'}
                  </button>
                  <button onClick={() => setShowOrderForm(false)} className="btn btn-gray">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer ID</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="table-empty">
                          No orders loaded. Click "Load Orders" to fetch data.
                        </td>
                      </tr>
                    ) : (
                      orders.map(order => (
                        <tr key={order.order_id}>
                          <td className="table-id">{order.order_id.substring(0, 8)}...</td>
                          <td className="table-id">{order.customer_id.substring(0, 8)}...</td>
                          <td>{order.items?.length || 0} items</td>
                          <td className="table-price">${order.total_amount?.toFixed(2)}</td>
                          <td>
                            <span className={`badge badge-${order.status === 'pending' ? 'yellow' : 'green'}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>{new Date(order.timestamp).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-section">
            <h2 className="section-title">System Architecture</h2>
            
            <div className="card">
              <h3 className="card-title">AWS Services Used</h3>
              <div className="services-grid">
                {[
                  { name: 'API Gateway', desc: 'REST API' },
                  { name: 'Lambda', desc: '5 Functions' },
                  { name: 'DynamoDB', desc: '4 Tables' },
                  { name: 'RDS PostgreSQL', desc: 'Analytics DB' },
                  { name: 'Redshift', desc: 'Data Warehouse' },
                  { name: 'VPC', desc: 'Network' },
                  { name: 'IAM', desc: 'Security' },
                  { name: 'CloudWatch', desc: 'Monitoring' }
                ].map((service, idx) => (
                  <div key={idx} className="service-card">
                    <p className="service-name">{service.name}</p>
                    <p className="service-desc">{service.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Lambda Functions</h3>
              <div className="functions-list">
                {[
                  { 
                    name: 'ecommerce-product-manager',
                    desc: 'Handles product CRUD operations',
                    endpoints: ['GET /products', 'POST /products', 'PUT /products/{id}', 'DELETE /products/{id}']
                  },
                  { 
                    name: 'ecommerce-order-processor',
                    desc: 'Manages order creation and retrieval',
                    endpoints: ['GET /orders', 'POST /orders', 'GET /customers/{id}/orders']
                  },
                  { 
                    name: 'ecommerce-stream-processor',
                    desc: 'Processes DynamoDB streams to RDS PostgreSQL',
                    endpoints: ['Triggered by DynamoDB Streams']
                  },
                  { 
                    name: 'ecommerce-redshift-etl',
                    desc: 'Daily ETL from RDS to Redshift data warehouse',
                    endpoints: ['Scheduled via EventBridge (daily at midnight)']
                  }
                ].map((func, idx) => (
                  <div key={idx} className="function-card">
                    <p className="function-name">{func.name}</p>
                    <p className="function-desc">{func.desc}</p>
                    <div className="endpoints">
                      {func.endpoints.map((endpoint, eidx) => (
                        <span key={eidx} className="endpoint">{endpoint}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="architecture-grid">
              <div className="card">
                <h3 className="card-title">
                  <Database size={24} style={{display: 'inline', marginRight: '0.5rem'}} />
                  Data Flow
                </h3>
                <div className="data-flow">
                  {[
                    { num: 1, title: 'API Gateway', desc: 'REST API receives CRUD operations' },
                    { num: 2, title: 'Lambda Functions', desc: 'Process business logic and data operations' },
                    { num: 3, title: 'DynamoDB', desc: 'Store operational data with streams enabled' },
                    { num: 4, title: 'Stream Processing', desc: 'Lambda processes changes to RDS PostgreSQL' },
                    { num: 5, title: 'ETL to Redshift', desc: 'Daily batch processing to data warehouse' }
                  ].map((step) => (
                    <div key={step.num} className="flow-step">
                      <div className="flow-number">{step.num}</div>
                      <div>
                        <p className="flow-title">{step.title}</p>
                        <p className="flow-desc">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card card-instructions">
                <h3 className="card-title">Setup Instructions</h3>
                <ol className="instructions-list">
                  <li>Update the API Gateway Endpoint in the header</li>
                  <li>Ensure all Lambda functions are deployed and API Gateway is configured</li>
                  <li>Create DynamoDB tables with streams enabled</li>
                  <li>Set up RDS PostgreSQL and run schema creation scripts</li>
                  <li>Configure Redshift cluster and create warehouse tables</li>
                  <li>Deploy the Redshift ETL Lambda with EventBridge schedule</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>E-commerce Analytics Platform - AWS Cloud Architecture</p>
          <p>Built with React + API Gateway + Lambda + DynamoDB + RDS + Redshift</p>
        </div>
      </footer>
    </div>
  );
}

export default App;