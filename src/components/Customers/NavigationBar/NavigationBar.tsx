import { useEffect } from "react"
import { Container, Nav, Navbar } from "react-bootstrap"
import { Link, useParams } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { fetchAllShops, fetchShopList } from "../../../redux/slices/shopSlice"
import { fetchUserData } from "../../../redux/slices/userSlice"
import { AiFillHome, AiOutlineHome } from "react-icons/ai"
import { IoCart, IoCartOutline } from "react-icons/io5"
import { FaRegUserCircle, FaUserCircle } from "react-icons/fa"
import "./NavigationBar.css"
import { selectCartPointers } from "../../../redux/slices/cartSlice"

const NavigationBar = () => {
    const dispatch = useAppDispatch()
    const { shopId, tableId } = useAppSelector(selectCartPointers)


    useEffect(() => {
        dispatch(fetchUserData())
        dispatch(fetchAllShops())
        // dispatch(fetchShopList())
    },[])
    
    // const params = useParams()
    // const shopId = params.shopId
    // const tableId = params.tableId
    console.log();
    
    // useEffect(() => {
    //     const shopId = params.shopId
    //     const tableId = params.tableId
    // }, [params])

    return(
        <>
            <Container fluid>
                <Navbar className="p-0" fixed="bottom" bg="light" variant="light">
                    <Container>
                        {/* <Navbar.Brand href="#home">Navbar</Navbar.Brand> */}
                        <Nav className="mx-auto">
                            <Nav.Link href="/">
                                <AiOutlineHome size={35}/>
                                {/* <AiFillHome/> */}
                            </Nav.Link>
                            {/* <Nav.Link href={`/shops/${shopId}/tables/${tableId}/cart`}> */}
                                <Link className="nav-link" to={`/shops/${shopId}/tables/${tableId}/cart`}>
                                    <IoCartOutline size={35}/>
                                    {/* <IoCart/> */}
                                </Link>
                            {/* </Nav.Link> */}
                            <Nav.Link href="#pricing">
                                <FaRegUserCircle size={30}/>
                                {/* <FaUserCircle/> */}
                            </Nav.Link>
                        </Nav>
                    </Container>
                </Navbar>
            </Container>
        </>
    )
}

export default NavigationBar