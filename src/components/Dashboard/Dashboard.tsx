import { useAppDispatch } from "../../redux/app/hooks"
import { Container } from "react-bootstrap"
import { useEffect } from "react"
import { fetchUserData } from "../../redux/slices/userSlice"
import ShopList from "../Shops/ShopList/ShopList"
import { fetchShopList } from "../../redux/slices/shopSlice"

const Dashboard = () => {
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(fetchUserData())
        dispatch(fetchShopList())
    }, )

    return (
        <Container>
            <ShopList/>
        </Container>
    )
}

export default Dashboard