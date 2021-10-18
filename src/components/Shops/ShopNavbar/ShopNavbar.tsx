import { useEffect } from "react"
import { Container, Nav, Navbar } from "react-bootstrap"
import { FaRegUserCircle } from "react-icons/fa"
import { Link } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { fetchSingleShop, selectSelectedShop } from "../../../redux/slices/shopSlice"
import "./ShopNavbar.css"

const ShopNavbar = () => {
    
    const shop = useAppSelector(selectSelectedShop)

    return(
        <>
            <Navbar bg="light">
                <Container>
                    <Navbar.Brand href="#home">
                        <img
                            src="https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png"
                            width="30"
                            height="30"
                            className="d-inline-block align-top"
                            alt="React Bootstrap logo"
                        />
                    </Navbar.Brand>
                    {/* <Navbar.Toggle aria-controls="responsive-navbar-nav" /> */}
                    {/* <Navbar.Collapse id="responsive-navbar-nav"> */}
                        <Nav className="w-100 justify-content-between">
                            <Link className="nav-link" to={`/`} >
                                My Shops
                            </Link>
                            <Link className="nav-link" to={`/myAccount`} >
                                <FaRegUserCircle size={30}/>
                                {/* My Account */}
                            </Link>
                            {/* <Nav.Link href="#shopList">My Shops</Nav.Link> */}
                        </Nav>
                    {/* </Navbar.Collapse> */}
                </Container>
            </Navbar>
        </>
    )
}

export default ShopNavbar