import { Container, Navbar } from "react-bootstrap"
import "./ShopNavbar.css"

const ShopNavbar = () => {
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
                </Container>
            </Navbar>
        </>
    )
}

export default ShopNavbar