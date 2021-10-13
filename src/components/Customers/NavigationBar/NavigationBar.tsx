import { useEffect } from "react"
import { Container, Nav, Navbar } from "react-bootstrap"
import { Link, useParams } from "react-router-dom"
import { useAppDispatch } from "../../../redux/app/hooks"
import { fetchShopList } from "../../../redux/slices/shopSlice"
import { fetchUserData } from "../../../redux/slices/userSlice"
import "./NavigationBar.css"

const NavigationBar = () => {
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(fetchUserData())
        dispatch(fetchShopList())
    },[])
    
    const params = useParams<{shopId: string, tableId: string}>()
    const shopId = params.shopId
    const tableId = params.tableId
    console.log(shopId);
    
    useEffect(() => {
        const shopId = params.shopId
        const tableId = params.tableId
    }, [params])

    return(
        <>
            <Container fluid>
                <Navbar fixed="bottom" bg="light" variant="light">
                    <Container>
                        <Navbar.Brand href="#home">Navbar</Navbar.Brand>
                        <Nav className="me-auto">
                            <Nav.Link href="#home">Home</Nav.Link>
                            <Nav.Link>
                                <Link className="nav-link" to={`/shops/${shopId}/tables/${tableId}/cart`}>
                                    Orders
                                </Link>
                            </Nav.Link>
                            <Nav.Link href="#pricing">Account</Nav.Link>
                        </Nav>
                    </Container>
                </Navbar>
            </Container>
        </>
    )
}

export default NavigationBar