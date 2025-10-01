import requests
import json
import time
import random
from datetime import datetime
from typing import List, Dict

# Configuration
API_BASE_URL = "https://ovqgzgx7vj.execute-api.us-east-1.amazonaws.com/prod"
REGION = "us-east-1"

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_section(title):
    print(f"\n{Colors.BLUE}{'='*60}")
    print(f"{title}")
    print(f"{'='*60}{Colors.END}\n")

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.YELLOW}ℹ {message}{Colors.END}")

# Sample product data
SAMPLE_PRODUCTS = [
    {
        "name": "Laptop Pro 15",
        "category": "Electronics",
        "price": 1299.99,
        "description": "High-performance laptop with 16GB RAM",
        "initial_stock": 50
    },
    {
        "name": "Wireless Mouse",
        "category": "Electronics",
        "price": 29.99,
        "description": "Ergonomic wireless mouse",
        "initial_stock": 100
    },
    {
        "name": "Running Shoes",
        "category": "Sports",
        "price": 89.99,
        "description": "Professional running shoes",
        "initial_stock": 75
    },
    {
        "name": "Coffee Maker",
        "category": "Home & Garden",
        "price": 129.99,
        "description": "Programmable coffee maker",
        "initial_stock": 40
    },
    {
        "name": "Python Programming Book",
        "category": "Books",
        "price": 49.99,
        "description": "Complete guide to Python",
        "initial_stock": 60
    },
    {
        "name": "Yoga Mat",
        "category": "Sports",
        "price": 34.99,
        "description": "Non-slip yoga mat",
        "initial_stock": 80
    },
    {
        "name": "Bluetooth Speaker",
        "category": "Electronics",
        "price": 79.99,
        "description": "Portable bluetooth speaker",
        "initial_stock": 55
    },
    {
        "name": "Office Chair",
        "category": "Home & Garden",
        "price": 249.99,
        "description": "Ergonomic office chair",
        "initial_stock": 30
    }
]

# Generate customer IDs
CUSTOMERS = [f"customer_{i:03d}" for i in range(1, 26)]

def test_api_connectivity():
    """Test basic API connectivity"""
    print_section("Testing API Connectivity")
    try:
        response = requests.get(f"{API_BASE_URL}/products", timeout=10)
        if response.status_code in [200, 404]:
            print_success(f"API is reachable (Status: {response.status_code})")
            return True
        else:
            print_error(f"API returned unexpected status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Failed to connect to API: {str(e)}")
        return False

def create_products() -> List[str]:
    """Create sample products and return their IDs"""
    print_section("Creating Sample Products")
    product_ids = []
    
    for idx, product in enumerate(SAMPLE_PRODUCTS, 1):
        try:
            print_info(f"Creating product {idx}/{len(SAMPLE_PRODUCTS)}: {product['name']}")
            response = requests.post(
                f"{API_BASE_URL}/products",
                json=product,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 201:
                result = response.json()
                product_id = result.get('product_id')
                product_ids.append(product_id)
                print_success(f"Created: {product['name']} (ID: {product_id[:8]}...)")
            else:
                print_error(f"Failed to create {product['name']}: {response.status_code} - {response.text}")
        except Exception as e:
            print_error(f"Error creating {product['name']}: {str(e)}")
        
        time.sleep(0.5)  # Rate limiting
    
    print_info(f"\nTotal products created: {len(product_ids)}/{len(SAMPLE_PRODUCTS)}")
    return product_ids

def get_all_products() -> List[Dict]:
    """Retrieve all products"""
    print_section("Retrieving All Products")
    try:
        response = requests.get(f"{API_BASE_URL}/products", timeout=10)
        if response.status_code == 200:
            products = response.json()
            print_success(f"Retrieved {len(products)} products")
            
            # Display summary
            for product in products[:5]:  # Show first 5
                print(f"  - {product.get('product_name', 'N/A')} | "
                      f"${product.get('price', 0)} | "
                      f"Category: {product.get('category', 'N/A')}")
            
            if len(products) > 5:
                print(f"  ... and {len(products) - 5} more")
            
            return products
        else:
            print_error(f"Failed to retrieve products: {response.status_code}")
            return []
    except Exception as e:
        print_error(f"Error retrieving products: {str(e)}")
        return []

def test_category_query():
    """Test querying products by category"""
    print_section("Testing Category Query")
    test_category = "Electronics"
    
    try:
        response = requests.get(
            f"{API_BASE_URL}/products",
            params={'category': test_category},
            timeout=10
        )
        
        if response.status_code == 200:
            products = response.json()
            print_success(f"Found {len(products)} products in '{test_category}' category")
            for product in products:
                print(f"  - {product.get('product_name', 'N/A')} (${product.get('price', 0)})")
        else:
            print_error(f"Category query failed: {response.status_code}")
    except Exception as e:
        print_error(f"Error querying category: {str(e)}")

def create_orders(product_ids: List[str], num_orders: int = 20):
    """Create sample orders"""
    print_section(f"Creating {num_orders} Sample Orders")
    
    if not product_ids:
        print_error("No product IDs available for creating orders")
        return []
    
    order_ids = []
    
    for i in range(num_orders):
        try:
            # Random customer
            customer_id = random.choice(CUSTOMERS)
            
            # Random number of items (1-3)
            num_items = random.randint(1, 3)
            items = []
            
            for _ in range(num_items):
                product_id = random.choice(product_ids)
                quantity = random.randint(1, 3)
                price = round(random.uniform(20, 500), 2)
                
                items.append({
                    "product_id": product_id,
                    "quantity": quantity,
                    "price": price
                })
            
            order_data = {
                "customer_id": customer_id,
                "items": items
            }
            
            response = requests.post(
                f"{API_BASE_URL}/orders",
                json=order_data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 201:
                result = response.json()
                order_id = result.get('order_id')
                order_ids.append(order_id)
                total = result.get('total_amount', 0)
                print_success(f"Order {i+1}/{num_orders}: {order_id[:8]}... | "
                            f"Customer: {customer_id} | "
                            f"Items: {len(items)} | "
                            f"Total: ${total:.2f}")
            else:
                print_error(f"Order {i+1} failed: {response.status_code} - {response.text}")
        
        except Exception as e:
            print_error(f"Error creating order {i+1}: {str(e)}")
        
        time.sleep(0.5)  # Rate limiting
    
    print_info(f"\nTotal orders created: {len(order_ids)}/{num_orders}")
    return order_ids

def get_all_orders():
    """Retrieve all orders"""
    print_section("Retrieving All Orders")
    try:
        response = requests.get(f"{API_BASE_URL}/orders", timeout=10)
        if response.status_code == 200:
            orders = response.json()
            print_success(f"Retrieved {len(orders)} orders")
            
            # Calculate total revenue
            total_revenue = sum(order.get('total_amount', 0) for order in orders)
            print_info(f"Total Revenue: ${total_revenue:.2f}")
            
            # Display sample orders
            for order in orders[:5]:
                print(f"  - Order: {order.get('order_id', 'N/A')[:8]}... | "
                      f"Customer: {order.get('customer_id', 'N/A')[:12]}... | "
                      f"Total: ${order.get('total_amount', 0):.2f}")
            
            if len(orders) > 5:
                print(f"  ... and {len(orders) - 5} more")
            
            return orders
        else:
            print_error(f"Failed to retrieve orders: {response.status_code}")
            return []
    except Exception as e:
        print_error(f"Error retrieving orders: {str(e)}")
        return []

def get_customer_orders(customer_id: str):
    """Retrieve orders for a specific customer"""
    print_section(f"Retrieving Orders for Customer: {customer_id}")
    try:
        response = requests.get(
            f"{API_BASE_URL}/customers/{customer_id}/orders",
            timeout=10
        )
        
        if response.status_code == 200:
            orders = response.json()
            print_success(f"Found {len(orders)} orders for {customer_id}")
            
            total_spent = sum(order.get('total_amount', 0) for order in orders)
            print_info(f"Total spent by customer: ${total_spent:.2f}")
            
            for order in orders:
                print(f"  - {order.get('order_id', 'N/A')[:8]}... | "
                      f"${order.get('total_amount', 0):.2f} | "
                      f"{order.get('status', 'N/A')}")
        else:
            print_error(f"Failed to retrieve customer orders: {response.status_code}")
    except Exception as e:
        print_error(f"Error retrieving customer orders: {str(e)}")

def delete_sample_product(product_id: str):
    """Test product deletion"""
    print_section("Testing Product Deletion")
    try:
        response = requests.delete(
            f"{API_BASE_URL}/products/{product_id}",
            timeout=10
        )
        
        if response.status_code == 200:
            print_success(f"Successfully deleted product: {product_id[:8]}...")
        else:
            print_error(f"Failed to delete product: {response.status_code}")
    except Exception as e:
        print_error(f"Error deleting product: {str(e)}")

def generate_analytics_summary(orders: List[Dict]):
    """Generate analytics summary from orders"""
    print_section("Analytics Summary")
    
    if not orders:
        print_info("No orders available for analytics")
        return
    
    # Calculate metrics
    total_orders = len(orders)
    total_revenue = sum(order.get('total_amount', 0) for order in orders)
    avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
    
    # Unique customers
    unique_customers = len(set(order.get('customer_id') for order in orders))
    
    print_success(f"Total Orders: {total_orders}")
    print_success(f"Total Revenue: ${total_revenue:.2f}")
    print_success(f"Average Order Value: ${avg_order_value:.2f}")
    print_success(f"Unique Customers: {unique_customers}")

def main():
    """Main test execution"""
    print(f"\n{Colors.BLUE}")
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║   E-commerce Analytics Platform - Comprehensive Test     ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")
    
    print_info(f"API Endpoint: {API_BASE_URL}")
    print_info(f"Region: {REGION}")
    print_info(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test 1: API Connectivity
    if not test_api_connectivity():
        print_error("Cannot proceed without API connectivity")
        return
    
    time.sleep(1)
    
    # Test 2: Create Products
    product_ids = create_products()
    time.sleep(2)
    
    # Test 3: Retrieve Products
    products = get_all_products()
    time.sleep(1)
    
    # Test 4: Test Category Query
    test_category_query()
    time.sleep(1)
    
    # Test 5: Create Orders
    order_ids = create_orders(product_ids, num_orders=20)
    time.sleep(2)
    
    # Test 6: Retrieve Orders
    orders = get_all_orders()
    time.sleep(1)
    
    # Test 7: Analytics Summary
    generate_analytics_summary(orders)
    
    # Test 8: Delete Product (optional - commented out to preserve data)
    if product_ids:
        delete_sample_product(product_ids[0])
    
    # Final Summary
    print_section("Test Execution Complete")
    print_success("All tests completed successfully!")
    print_info("\nNext Steps:")
    print("  1. Check DynamoDB tables for created data")
    print("  2. Verify DynamoDB Streams triggered Lambda")
    print("  3. Check RDS PostgreSQL for analytics data")
    print("  4. Run Redshift ETL Lambda or wait for scheduled execution")
    print("  5. Query Redshift data warehouse tables")
    print("\nData Pipeline Check:")
    print("  - DynamoDB → Streams → Lambda → RDS PostgreSQL (real-time)")
    print("  - RDS PostgreSQL → Lambda ETL → Redshift (daily)")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_error("\n\nTest interrupted by user")
    except Exception as e:
        print_error(f"\n\nUnexpected error: {str(e)}")